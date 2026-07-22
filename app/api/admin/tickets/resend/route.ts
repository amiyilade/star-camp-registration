import { NextRequest, NextResponse } from "next/server";

import { requireAdminForEvent } from "@/lib/auth/require-admin-for-event";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resendSingleTicketEmail } from "@/lib/send-ticket-emails";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const ticketId = body.ticketId as string | undefined;

  if (!ticketId) {
    return NextResponse.json(
      { error: "Ticket ID is required." },
      { status: 400 }
    );
  }

  const { data: ticket, error } = await supabaseAdmin
    .from("tickets")
    .select(`
      id,
      ticket_code,
      qr_token,
      attendee_id,
      event_id,
      order_id,
      registration_orders!inner (
        status
      ),
      attendees (
        first_name,
        last_name,
        email
      ),
      events (
        name,
        slug,
        location
      )
    `)
    .eq("id", ticketId)
    .single();

  if (error || !ticket) {
    return NextResponse.json(
      { error: "Ticket not found." },
      { status: 404 }
    );
  }

  const access = await requireAdminForEvent(ticket.event_id);

  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const order = Array.isArray(ticket.registration_orders)
    ? ticket.registration_orders[0]
    : ticket.registration_orders;

  if (order?.status !== "paid") {
    return NextResponse.json(
      {
        error: `Ticket cannot be resent because the registration is ${order?.status ?? "not paid"}.`
      },
      { status: 409 }
    );
  }

  const attendee = Array.isArray(ticket.attendees)
    ? ticket.attendees[0]
    : ticket.attendees;

  if (!attendee?.email) {
    return NextResponse.json(
      { error: "This attendee does not have an email address." },
      { status: 400 }
    );
  }

  await resendSingleTicketEmail(ticketId);

  await supabaseAdmin
    .from("tickets")
    .update({
      last_resent_at: new Date().toISOString()
    })
    .eq("id", ticket.id);

  return NextResponse.json({
    message: "Ticket resent successfully."
  });
}