import {
  NextRequest,
  NextResponse
} from "next/server";

import {
  supabaseAdmin
} from "@/lib/supabase/server";

export async function GET(
  request: NextRequest
) {
  try {
    const eventSlug =
      request.nextUrl.searchParams
        .get("eventSlug")
        ?.trim();

    if (!eventSlug) {
      return NextResponse.json(
        {
          error:
            "Event is required."
        },
        { status: 400 }
      );
    }

    const {
      data: event,
      error: eventError
    } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("slug", eventSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (
      eventError ||
      !event
    ) {
      return NextResponse.json(
        {
          error:
            "Event was not found."
        },
        { status: 404 }
      );
    }

    const {
      data: settings,
      error: settingsError
    } = await supabaseAdmin
      .from("event_payment_settings")
      .select(`
        paystack_enabled,
        cash_enabled,
        sponsorship_enabled
      `)
      .eq("event_id", event.id)
      .maybeSingle();

    if (settingsError) {
      console.error(
        "Public payment settings lookup failed:",
        settingsError
      );

      return NextResponse.json(
        {
          error:
            "Could not load payment options."
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      paystackEnabled:
        settings?.paystack_enabled ??
        true,

      cashEnabled:
        settings?.cash_enabled ??
        false,

      sponsorshipEnabled:
        settings?.sponsorship_enabled ??
        false
    });
  } catch (error) {
    console.error(
      "Payment options API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not load payment options."
      },
      { status: 500 }
    );
  }
}