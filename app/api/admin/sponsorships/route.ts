import {
  NextRequest,
  NextResponse
} from "next/server";

import { getManagedEvents } from "@/lib/auth/get-managed-events";
import { requireManagerForEvent } from "@/lib/auth/require-manager-for-event";
import { logAdminActivity } from "@/lib/admin/log-admin-activity";
import { supabaseAdmin } from "@/lib/supabase/server";

const FUNDING_TYPES = [
  "fixed_per_attendee",
  "full_fee"
] as const;

const ELIGIBILITY_MODES = [
  "code",
  "email",
  "code_and_email"
] as const;

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const { admin, events } = await getManagedEvents();

    if (!admin) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    if (events.length === 0) {
      return NextResponse.json(
        {
          error:
            "Manager access is required to view sponsorship campaigns."
        },
        { status: 403 }
      );
    }

    const requestedEventSlug =
      request.nextUrl.searchParams
        .get("eventSlug")
        ?.trim();

    const event = requestedEventSlug
      ? events.find(
          (availableEvent) =>
            availableEvent.slug === requestedEventSlug
        )
      : events[0];

    if (!event) {
      return NextResponse.json(
        {
          error:
            "You do not have manager access to the selected event."
        },
        { status: 403 }
      );
    }

    const { data: campaigns, error } =
      await supabaseAdmin
        .from("sponsorship_campaigns")
        .select(`
          id,
          event_id,
          name,
          description,
          funding_type,
          funding_value_ngn,
          eligibility_mode,
          attendee_limit,
          starts_at,
          ends_at,
          is_active,
          created_by_email,
          created_at,
          updated_at,
          sponsorship_codes (
            id,
            event_id,
            code,
            attendee_usage_limit,
            is_active,
            created_at
          ),
          sponsorship_email_eligibility (
            id,
            email,
            attendee_limit,
            is_active,
            created_at
          ),
          sponsorship_allocations (
            id,
            amount_ngn,
            status
          )
        `)
        .eq("event_id", event.id)
        .order("created_at", {
          ascending: false
        });

    if (error) {
      console.error(
        "Sponsorship campaign lookup failed:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Could not load sponsorship campaigns."
        },
        { status: 500 }
      );
    }

    const mappedCampaigns = (campaigns ?? []).map(
      (campaign) => {
        const allocations =
          campaign.sponsorship_allocations ?? [];

        const confirmed = allocations.filter(
          (allocation) =>
            allocation.status === "confirmed"
        );

        const reserved = allocations.filter(
          (allocation) =>
            allocation.status === "reserved"
        );

        return {
          ...campaign,

          usage: {
            confirmedAttendees:
              confirmed.length,

            reservedAttendees:
              reserved.length,

            confirmedAmountNgn:
              confirmed.reduce(
                (sum, allocation) =>
                  sum +
                  (allocation.amount_ngn ?? 0),
                0
              ),

            reservedAmountNgn:
              reserved.reduce(
                (sum, allocation) =>
                  sum +
                  (allocation.amount_ngn ?? 0),
                0
              )
          }
        };
      }
    );

    return NextResponse.json({
      event,

      availableEvents: events.map(
        (availableEvent) => ({
          id: availableEvent.id,
          name: availableEvent.name,
          slug: availableEvent.slug,
          location: availableEvent.location
        })
      ),

      campaigns: mappedCampaigns,

      viewer: {
        isSuperAdmin: admin.is_super_admin
      }
    });
  } catch (error) {
    console.error(
      "Sponsorship GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected sponsorship error."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const eventSlug =
      typeof body.eventSlug === "string"
        ? body.eventSlug.trim()
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const fundingType =
      typeof body.fundingType === "string"
        ? body.fundingType
        : "";

    const eligibilityMode =
      typeof body.eligibilityMode === "string"
        ? body.eligibilityMode
        : "";

    const attendeeLimit =
      body.attendeeLimit === null ||
      body.attendeeLimit === "" ||
      body.attendeeLimit === undefined
        ? null
        : Number(body.attendeeLimit);

    const fundingValueNgn =
      fundingType === "fixed_per_attendee"
        ? Number(body.fundingValueNgn)
        : null;

    const code =
      typeof body.code === "string"
        ? normalizeCode(body.code)
        : "";

    const codeUsageLimit =
      body.codeUsageLimit === null ||
      body.codeUsageLimit === "" ||
      body.codeUsageLimit === undefined
        ? null
        : Number(body.codeUsageLimit);

    const rawEmails: unknown[]  = Array.isArray(body.emails)
      ? body.emails
      : [];

    const emails = Array.from(
      new Set(
        rawEmails
          .filter(
            (email): email is string =>
              typeof email === "string"
          )
          .map(normalizeEmail)
          .filter(Boolean)
      )
    );

    if (!eventSlug || !name) {
      return NextResponse.json(
        {
          error:
            "Event and campaign name are required."
        },
        { status: 400 }
      );
    }

    if (
      !FUNDING_TYPES.includes(
        fundingType as
          (typeof FUNDING_TYPES)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid sponsorship funding type."
        },
        { status: 400 }
      );
    }

    if (
      !ELIGIBILITY_MODES.includes(
        eligibilityMode as
          (typeof ELIGIBILITY_MODES)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid sponsorship eligibility mode."
        },
        { status: 400 }
      );
    }

    if (fundingType === "fixed_per_attendee") {
        if (
            fundingValueNgn === null ||
            !Number.isInteger(fundingValueNgn) ||
            fundingValueNgn <= 0
        ) {
            return NextResponse.json(
            {
                error:
                "Fixed sponsorship amount must be greater than zero."
            },
            { status: 400 }
            );
        }
    }

    if (
      attendeeLimit !== null &&
      (
        !Number.isInteger(attendeeLimit) ||
        attendeeLimit <= 0
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Attendee limit must be a positive whole number."
        },
        { status: 400 }
      );
    }

    const requiresCode =
      eligibilityMode === "code" ||
      eligibilityMode === "code_and_email";

    const requiresEmail =
      eligibilityMode === "email" ||
      eligibilityMode === "code_and_email";

    if (requiresCode && !code) {
      return NextResponse.json(
        {
          error:
            "A sponsorship code is required for this eligibility mode."
        },
        { status: 400 }
      );
    }

    if (
      code &&
      (
        code.length < 4 ||
        code.length > 40
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Sponsorship codes must be between 4 and 40 characters."
        },
        { status: 400 }
      );
    }

    if (
      codeUsageLimit !== null &&
      (
        !Number.isInteger(codeUsageLimit) ||
        codeUsageLimit <= 0
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Code usage limit must be a positive whole number."
        },
        { status: 400 }
      );
    }

    if (
      requiresEmail &&
      emails.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "At least one approved attendee email is required."
        },
        { status: 400 }
      );
    }

    const { admin, events } =
      await getManagedEvents();

    if (!admin) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const event = events.find(
      (availableEvent) =>
        availableEvent.slug === eventSlug
    );

    if (!event) {
      return NextResponse.json(
        {
          error:
            "You do not have manager access to the selected event."
        },
        { status: 403 }
      );
    }

    const authorization =
      await requireManagerForEvent(event.id);

    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error:
            authorization.error
        },
        {
          status:
            authorization.status
        }
      );
    }

    /*
     * Sponsorship must first be enabled for this event.
     */
    const {
      data: paymentSettings,
      error: paymentSettingsError
    } = await supabaseAdmin
      .from("event_payment_settings")
      .select("sponsorship_enabled")
      .eq("event_id", event.id)
      .maybeSingle();

    if (paymentSettingsError) {
      return NextResponse.json(
        {
          error:
            "Could not check event sponsorship settings."
        },
        { status: 500 }
      );
    }

    if (
      !paymentSettings?.sponsorship_enabled
    ) {
      return NextResponse.json(
        {
          error:
            "Sponsorship is currently disabled for this event."
        },
        { status: 400 }
      );
    }

    if (requiresCode) {
      const {
        data: duplicateCode,
        error: duplicateCodeError
      } = await supabaseAdmin
        .from("sponsorship_codes")
        .select("id")
        .eq("event_id", event.id)
        .ilike("code", code)
        .maybeSingle();

      if (duplicateCodeError) {
        return NextResponse.json(
          {
            error:
              "Could not validate sponsorship code."
          },
          { status: 500 }
        );
      }

      if (duplicateCode) {
        return NextResponse.json(
          {
            error:
              "That sponsorship code is already in use for this event."
          },
          { status: 409 }
        );
      }
    }

    const now =
      new Date().toISOString();

    const {
      data: campaign,
      error: campaignError
    } = await supabaseAdmin
      .from("sponsorship_campaigns")
      .insert({
        event_id: event.id,
        name,
        description:
          description || null,

        funding_type:
          fundingType,

        funding_value_ngn:
          fundingValueNgn,

        eligibility_mode:
          eligibilityMode,

        attendee_limit:
          attendeeLimit,

        is_active: true,

        created_by_admin_id:
          authorization.admin.id,

        created_by_email:
          authorization.admin.email,

        created_at: now,
        updated_at: now
      })
      .select(`
        id,
        event_id,
        name,
        description,
        funding_type,
        funding_value_ngn,
        eligibility_mode,
        attendee_limit,
        is_active,
        created_at,
        updated_at
      `)
      .single();

    if (
      campaignError ||
      !campaign
    ) {
      console.error(
        "Sponsorship campaign insert failed:",
        campaignError
      );

      return NextResponse.json(
        {
          error:
            "Could not create sponsorship campaign."
        },
        { status: 500 }
      );
    }

    /*
     * If any child insert fails, delete the newly-created campaign.
     * CASCADE cleans up whatever child records were already inserted.
     */
    try {
      if (requiresCode) {
        const {
          error: codeError
        } = await supabaseAdmin
          .from("sponsorship_codes")
          .insert({
            campaign_id:
              campaign.id,

            event_id:
              event.id,

            code,

            attendee_usage_limit:
              codeUsageLimit,

            is_active: true
          });

        if (codeError) {
          throw codeError;
        }
      }

      if (requiresEmail) {
        const emailRows =
          emails.map((email) => ({
            campaign_id:
              campaign.id,

            email,

            attendee_limit: 1,

            is_active: true
          }));

        const {
          error: emailError
        } = await supabaseAdmin
          .from(
            "sponsorship_email_eligibility"
          )
          .insert(emailRows);

        if (emailError) {
          throw emailError;
        }
      }
    } catch (error) {
      console.error(
        "Sponsorship child record creation failed:",
        error
      );

      await supabaseAdmin
        .from("sponsorship_campaigns")
        .delete()
        .eq("id", campaign.id);

      return NextResponse.json(
        {
          error:
            "Could not finish creating the sponsorship campaign."
        },
        { status: 500 }
      );
    }

    await logAdminActivity({
      adminUserId:
        authorization.admin.id,

      adminEmail:
        authorization.admin.email,

      eventId:
        event.id,

      action:
        "sponsorship_campaign_created",

      outcome:
        "success",

      notes:
        `Created sponsorship campaign "${name}".`,

      metadata: {
        campaignId:
          campaign.id,

        fundingType,
        fundingValueNgn,
        eligibilityMode,
        attendeeLimit,

        hasCode:
          requiresCode,

        approvedEmailCount:
          requiresEmail
            ? emails.length
            : 0
      }
    });

    return NextResponse.json(
      {
        success: true,
        campaign
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Sponsorship POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected sponsorship creation error."
      },
      { status: 500 }
    );
  }
}