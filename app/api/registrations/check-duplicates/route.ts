import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { registrationSchema } from "@/lib/registration-schema";

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(request: Request) {
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

    const firstName = normalizeName(attendee.firstName);
    const lastName = normalizeName(attendee.lastName);

    const { data: matches, error } = await supabaseAdmin
      .from("attendees")
      .select("id")
      .eq("event_id", event.id)
      .ilike("first_name", firstName)
      .ilike("last_name", lastName)
      .eq("date_of_birth", attendee.dateOfBirth)
      .limit(1);

    if (error) {
      return NextResponse.json(
        { error: error.message },
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
}