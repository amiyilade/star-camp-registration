import { NextRequest, NextResponse } from "next/server";

import { requireAdminForEvent } from "@/lib/auth/require-admin-for-event";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const ticketId = body.ticketId as string | undefined;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Ticket ID is required." },
        { status: 400 }
      );
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("id, attendee_id, event_id, status, checked_in_at, checked_out_at")
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
      await supabaseAdmin.from("checkin_logs").insert({
        ticket_id: ticket.id,
        attendee_id: ticket.attendee_id,
        event_id: ticket.event_id,
        admin_user_id: access.admin?.id ?? null,
        admin_email: access.admin?.email ?? "unknown",
        action: "access_denied",
        notes: access.error
      });

      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const isCurrentlyCheckedIn =
        ticket.checked_in_at &&
        (!ticket.checked_out_at ||
            new Date(ticket.checked_in_at) > new Date(ticket.checked_out_at));

    if (!isCurrentlyCheckedIn) {
      await supabaseAdmin.from("checkin_logs").insert({
        ticket_id: ticket.id,
        attendee_id: ticket.attendee_id,
        event_id: ticket.event_id,
        admin_user_id: access.admin.id,
        admin_email: access.admin.email,
        action: "duplicate_attempt",
        notes: "Check-out attempted before check-in."
      });

      return NextResponse.json(
        { error: "This ticket has not been checked in yet." },
        { status: 400 }
      );
    }

    if (ticket.checked_out_at) {
      await supabaseAdmin.from("checkin_logs").insert({
        ticket_id: ticket.id,
        attendee_id: ticket.attendee_id,
        event_id: ticket.event_id,
        admin_user_id: access.admin.id,
        admin_email: access.admin.email,
        action: "duplicate_attempt",
        notes: "Duplicate check-out attempt."
      });

      return NextResponse.json(
        { error: "This ticket has already been checked out." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const { data: updatedTicket, error: updateError } = await supabaseAdmin
      .from("tickets")
      .update({
        checked_out_at: now
      })
      .eq("id", ticket.id)
      .is("checked_out_at", null)
      .select("id, ticket_code, status, checked_in_at, checked_out_at")
      .single();

    if (updateError || !updatedTicket) {
      return NextResponse.json(
        { error: "Could not check out ticket. It may have already been checked out." },
        { status: 409 }
      );
    }

    await supabaseAdmin.from("checkin_logs").insert({
      ticket_id: ticket.id,
      attendee_id: ticket.attendee_id,
      event_id: ticket.event_id,
      admin_user_id: access.admin.id,
      admin_email: access.admin.email,
      action: "check_out",
      notes: "Ticket checked out."
    });

    return NextResponse.json({
      message: "Checked out successfully.",
      ticket: updatedTicket
    });
  } catch (error) {
    console.error("Check-out error:", error);

    return NextResponse.json(
      { error: "Unexpected check-out error." },
      { status: 500 }
    );
  }
}