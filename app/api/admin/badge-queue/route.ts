import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/get-admin-user";
import { requireAdminForEvent } from "@/lib/auth/require-admin-for-event";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const admin = await getAdminUser();

  if (!admin) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  }

  const eventSlug = request.nextUrl.searchParams.get("eventSlug");

  if (!eventSlug) {
    return NextResponse.json(
      { error: "Event slug is required." },
      { status: 400 }
    );
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("id, name, slug")
    .eq("slug", eventSlug)
    .single();

  if (eventError || !event) {
    return NextResponse.json(
      { error: "Event not found." },
      { status: 404 }
    );
  }

  const access = await requireAdminForEvent(event.id);

  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const { data: tickets, error } = await supabaseAdmin
    .from("tickets")
    .select(`
      id,
      ticket_code,
      checked_in_at,
      badge_status,
      badge_printed_at,
      badge_issued_at,
      attendees (
        first_name,
        last_name,
        department,
        age_at_registration
      ),
      teams:assigned_team_id (
        code,
        name
      )
    `)
    .eq("event_id", event.id)
    .not("checked_in_at", "is", null)
    .order("checked_in_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    event,
    tickets
  });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();

  if (!admin) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  }

  const body = await request.json();

  const ticketId = body.ticketId as string | undefined;
  const action = body.action as "mark_printed" | "mark_issued" | undefined;

  if (!ticketId || !action) {
    return NextResponse.json(
      { error: "Ticket ID and action are required." },
      { status: 400 }
    );
  }

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("tickets")
    .select("id, attendee_id, event_id")
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json(
      { error: "Ticket not found." },
      { status: 404 }
    );
  }

  const access = await requireAdminForEvent(ticket.event_id);

  if (!access.allowed || !access.admin) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const update =
    action === "mark_printed"
      ? {
          badge_status: "printed",
          badge_printed_at: new Date().toISOString()
        }
      : {
          badge_status: "issued",
          badge_issued_at: new Date().toISOString(),
          badge_issued_by_email: access.admin.email
        };

  const { data: updatedTicket, error: updateError } = await supabaseAdmin
    .from("tickets")
    .update(update)
    .eq("id", ticket.id)
    .select(`
      id,
      ticket_code,
      checked_in_at,
      badge_status,
      badge_printed_at,
      badge_issued_at,
      attendees (
        first_name,
        last_name,
        department,
        age_at_registration
      ),
      teams:assigned_team_id (
        code,
        name
      )
    `)
    .single();

  if (updateError || !updatedTicket) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not update badge status." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ticket: updatedTicket
  });
}