import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const eventSlug =
      typeof body.eventSlug === "string"
        ? body.eventSlug.trim()
        : "";

    const code =
      typeof body.code === "string"
        ? normalizeCode(body.code)
        : "";

    if (!eventSlug || !code) {
      return NextResponse.json(
        {
          valid: false,
          error: "This sponsorship code is invalid or unavailable."
        },
        { status: 400 }
      );
    }

    const { data: event, error: eventError } =
      await supabaseAdmin
        .from("events")
        .select("id")
        .eq("slug", eventSlug)
        .single();

    if (eventError || !event) {
      return NextResponse.json(
        {
          valid: false,
          error: "This sponsorship code is invalid or unavailable."
        },
        { status: 404 }
      );
    }

    const { data: settings, error: settingsError } =
      await supabaseAdmin
        .from("event_payment_settings")
        .select("sponsorship_enabled")
        .eq("event_id", event.id)
        .maybeSingle();

    if (
      settingsError ||
      !settings?.sponsorship_enabled
    ) {
      return NextResponse.json(
        {
          valid: false,
          error: "This sponsorship code is invalid or unavailable."
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: sponsorshipCode, error: codeError } =
      await supabaseAdmin
        .from("sponsorship_codes")
        .select(`
          id,
          code,
          attendee_usage_limit,
          is_active,
          sponsorship_campaigns!inner (
            id,
            event_id,
            funding_type,
            funding_value_ngn,
            eligibility_mode,
            attendee_limit,
            starts_at,
            ends_at,
            is_active
          )
        `)
        .eq("event_id", event.id)
        .ilike("code", code)
        .eq("is_active", true)
        .maybeSingle();

    if (codeError || !sponsorshipCode) {
      return NextResponse.json(
        {
          valid: false,
          error: "This sponsorship code is invalid or unavailable."
        },
        { status: 200 }
      );
    }

    const campaign = Array.isArray(
      sponsorshipCode.sponsorship_campaigns
    )
      ? sponsorshipCode.sponsorship_campaigns[0]
      : sponsorshipCode.sponsorship_campaigns;

    if (
      !campaign ||
      !campaign.is_active ||
      campaign.event_id !== event.id
    ) {
      return NextResponse.json(
        {
          valid: false,
          error: "This sponsorship code is invalid or unavailable."
        },
        { status: 200 }
      );
    }

    if (
      campaign.starts_at &&
      campaign.starts_at > now
    ) {
      return NextResponse.json(
        {
          valid: false,
          error: "This sponsorship code is invalid or unavailable."
        },
        { status: 200 }
      );
    }

    if (
      campaign.ends_at &&
      campaign.ends_at < now
    ) {
      return NextResponse.json(
        {
          valid: false,
          error: "This sponsorship code is invalid or unavailable."
        },
        { status: 200 }
      );
    }

    const requiresAttendeeEmail =
      campaign.eligibility_mode === "email" ||
      campaign.eligibility_mode === "code_and_email";

    return NextResponse.json({
      valid: true,

      requiresAttendeeEmail,

      fundingType:
        campaign.funding_type,

      fundingValueNgn:
        campaign.funding_type === "fixed_per_attendee"
          ? campaign.funding_value_ngn
          : null
    });
  } catch (error) {
    console.error(
      "Sponsorship inspect error:",
      error
    );

    return NextResponse.json(
      {
        valid: false,
        error: "This sponsorship code is invalid or unavailable."
      },
      { status: 500 }
    );
  }
}