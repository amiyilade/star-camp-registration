import {
  NextRequest,
  NextResponse
} from "next/server";

import { getManagedEvents } from "@/lib/auth/get-managed-events";
import { requireManagerForEvent } from "@/lib/auth/require-manager-for-event";
import { logAdminActivity } from "@/lib/admin/log-admin-activity";
import { supabaseAdmin } from "@/lib/supabase/server";

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
            "Manager access is required to view payment settings."
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

    const { data: settings, error } =
      await supabaseAdmin
        .from("event_payment_settings")
        .select(`
          event_id,
          paystack_enabled,
          cash_enabled,
          sponsorship_enabled,
          cash_payment_deadline_minutes,
          cash_instructions,
          updated_at,
          updated_by_email
        `)
        .eq("event_id", event.id)
        .maybeSingle();

    if (error) {
      console.error(
        "Payment settings lookup failed:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Could not load payment settings."
        },
        { status: 500 }
      );
    }

    /*
     * This should not normally be needed because we seeded every
     * existing event, but it also makes newly-created events safe.
     */
    if (!settings) {
      const { data: createdSettings, error: createError } =
        await supabaseAdmin
          .from("event_payment_settings")
          .insert({
            event_id: event.id,
            paystack_enabled: true,
            cash_enabled: false,
            sponsorship_enabled: false,
            cash_payment_deadline_minutes: 120
          })
          .select(`
            event_id,
            paystack_enabled,
            cash_enabled,
            sponsorship_enabled,
            cash_payment_deadline_minutes,
            cash_instructions,
            updated_at,
            updated_by_email
          `)
          .single();

      if (createError) {
        console.error(
          "Could not create payment settings:",
          createError
        );

        return NextResponse.json(
          {
            error:
              "Could not initialize payment settings."
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        event,
        settings: createdSettings,
        availableEvents: events.map(
          (availableEvent) => ({
            id: availableEvent.id,
            name: availableEvent.name,
            slug: availableEvent.slug,
            location: availableEvent.location
          })
        ),
        viewer: {
          isSuperAdmin: admin.is_super_admin
        }
      });
    }

    return NextResponse.json({
      event,
      settings,
      availableEvents: events.map(
        (availableEvent) => ({
          id: availableEvent.id,
          name: availableEvent.name,
          slug: availableEvent.slug,
          location: availableEvent.location
        })
      ),
      viewer: {
        isSuperAdmin: admin.is_super_admin
      }
    });
  } catch (error) {
    console.error(
      "Payment settings GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected payment-settings error."
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const eventSlug =
      typeof body.eventSlug === "string"
        ? body.eventSlug.trim()
        : "";

    if (!eventSlug) {
      return NextResponse.json(
        {
          error: "Event is required."
        },
        { status: 400 }
      );
    }

    const { admin, events } = await getManagedEvents();

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

    /*
     * Perform the explicit authorization check as well.
     * This protects the write independently from the event list.
     */
    const authorization =
      await requireManagerForEvent(event.id);

    if (!authorization.allowed) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status }
      );
    }

    if (
      typeof body.paystackEnabled !== "boolean" ||
      typeof body.cashEnabled !== "boolean" ||
      typeof body.sponsorshipEnabled !== "boolean"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid payment-setting values."
        },
        { status: 400 }
      );
    }

    /*
     * Sponsorship is not a general payment method because not every
     * registrant will be eligible. At least Paystack or cash must
     * therefore remain available.
     */
    if (
      !body.paystackEnabled &&
      !body.cashEnabled
    ) {
      return NextResponse.json(
        {
          error:
            "At least Paystack or cash must remain enabled."
        },
        { status: 400 }
      );
    }

    const cashDeadlineMinutes =
      Number(body.cashPaymentDeadlineMinutes);

    if (
      !Number.isInteger(cashDeadlineMinutes) ||
      cashDeadlineMinutes < 15 ||
      cashDeadlineMinutes > 1440
    ) {
      return NextResponse.json(
        {
          error:
            "Cash payment deadline must be between 15 minutes and 24 hours."
        },
        { status: 400 }
      );
    }

    const cashInstructions =
      typeof body.cashInstructions === "string"
        ? body.cashInstructions.trim()
        : "";

    if (
      body.cashEnabled &&
      cashInstructions.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Cash instructions are required when cash payments are enabled."
        },
        { status: 400 }
      );
    }

    if (cashInstructions.length > 1000) {
      return NextResponse.json(
        {
          error:
            "Cash instructions must be 1000 characters or fewer."
        },
        { status: 400 }
      );
    }

    const { data: previousSettings } =
      await supabaseAdmin
        .from("event_payment_settings")
        .select(`
          paystack_enabled,
          cash_enabled,
          sponsorship_enabled,
          cash_payment_deadline_minutes,
          cash_instructions
        `)
        .eq("event_id", event.id)
        .maybeSingle();

    const updatedAt =
      new Date().toISOString();

    const { data: settings, error } =
      await supabaseAdmin
        .from("event_payment_settings")
        .upsert(
          {
            event_id: event.id,

            paystack_enabled:
              body.paystackEnabled,

            cash_enabled:
              body.cashEnabled,

            sponsorship_enabled:
              body.sponsorshipEnabled,

            cash_payment_deadline_minutes:
              cashDeadlineMinutes,

            cash_instructions:
              cashInstructions || null,

            updated_at: updatedAt,
            updated_by_email:
              authorization.admin.email
          },
          {
            onConflict: "event_id"
          }
        )
        .select(`
          event_id,
          paystack_enabled,
          cash_enabled,
          sponsorship_enabled,
          cash_payment_deadline_minutes,
          cash_instructions,
          updated_at,
          updated_by_email
        `)
        .single();

    if (error) {
      console.error(
        "Payment settings update failed:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Could not update payment settings."
        },
        { status: 500 }
      );
    }

    await logAdminActivity({
      adminUserId:
        authorization.admin.id,
      adminEmail:
        authorization.admin.email,
      eventId: event.id,
      action: "payment_settings_updated",
      outcome: "success",
      notes:
        "Event payment settings were updated.",
      metadata: {
        eventSlug: event.slug,

        previous: previousSettings
          ? {
              paystackEnabled:
                previousSettings.paystack_enabled,

              cashEnabled:
                previousSettings.cash_enabled,

              sponsorshipEnabled:
                previousSettings.sponsorship_enabled,

              cashPaymentDeadlineMinutes:
                previousSettings.cash_payment_deadline_minutes
            }
          : null,

        current: {
          paystackEnabled:
            settings.paystack_enabled,

          cashEnabled:
            settings.cash_enabled,

          sponsorshipEnabled:
            settings.sponsorship_enabled,

          cashPaymentDeadlineMinutes:
            settings.cash_payment_deadline_minutes
        }
      }
    });

    return NextResponse.json({
      success: true,
      event,
      settings
    });
  } catch (error) {
    console.error(
      "Payment settings PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected payment-settings error."
      },
      { status: 500 }
    );
  }
}