import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { registrationSchema } from "@/lib/registration-schema";

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = registrationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid registration data." },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("slug", data.eventSlug)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Selected event was not found." },
        { status: 404 }
      );
    }

    const duplicateIndexes: number[] = [];

    for (let index = 0; index < data.attendees.length; index++) {
      const attendee = data.attendees[index];

      const { data: matches, error } = await supabaseAdmin
        .from("attendees")
        .select(`
          id,
          registration_orders!inner(status)
        `)
        .eq("event_id", event.id)
        .ilike("first_name", normalizeName(attendee.firstName))
        .ilike("last_name", normalizeName(attendee.lastName))
        .eq("date_of_birth", attendee.dateOfBirth)
        .in("registration_orders.status", ["pending_payment", "paid"])
        .limit(1);

      if (error) {
        console.error("Duplicate check error:", error);

        return NextResponse.json(
          { error: "Could not check for duplicate registrations." },
          { status: 500 }
        );
      }

      if (matches && matches.length > 0) {
        duplicateIndexes.push(index);
      }
    }

    return NextResponse.json({
      duplicateIndexes
    });
  } catch (error) {
    console.error("Duplicate check API error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}