import { NextRequest, NextResponse } from "next/server";

import { requireAdminForEvent } from "@/lib/auth/require-admin-for-event";
import { supabaseAdmin } from "@/lib/supabase/server";
import { assignTeam } from "@/lib/teams/assign-team";

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
      .select(`
        id,
        attendee_id,
        event_id,
        order_id,
        status,
        checked_in_at,
        checked_out_at,
        registration_orders!inner (
          status
        )
      `)
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

    const order = Array.isArray(ticket.registration_orders)
      ? ticket.registration_orders[0]
      : ticket.registration_orders;

    if (order?.status !== "paid") {
      await supabaseAdmin.from("checkin_logs").insert({
        ticket_id: ticket.id,
        attendee_id: ticket.attendee_id,
        event_id: ticket.event_id,
        admin_user_id: access.admin.id,
        admin_email: access.admin.email,
        action: "duplicate_attempt",
        notes: `Check-in rejected because order status is ${order?.status ?? "unknown"}.`
      });

      return NextResponse.json(
        {
          error: `Ticket is not valid for entry. Payment status: ${
            order?.status ?? "unknown"
          }.`
        },
        { status: 400 }
      );
    }

    if (ticket.status !== "valid") {
      await supabaseAdmin.from("checkin_logs").insert({
        ticket_id: ticket.id,
        attendee_id: ticket.attendee_id,
        event_id: ticket.event_id,
        admin_user_id: access.admin.id,
        admin_email: access.admin.email,
        action: "duplicate_attempt",
        notes: `Invalid ticket status for check-in: ${ticket.status}`
      });

      return NextResponse.json(
        { error: `Ticket is not valid. Current status: ${ticket.status}` },
        { status: 400 }
      );
    }

    const isCurrentlyCheckedIn =
      ticket.checked_in_at &&
      (!ticket.checked_out_at ||
        new Date(ticket.checked_in_at) > new Date(ticket.checked_out_at));

    if (isCurrentlyCheckedIn) {
      await supabaseAdmin.from("checkin_logs").insert({
        ticket_id: ticket.id,
        attendee_id: ticket.attendee_id,
        event_id: ticket.event_id,
        admin_user_id: access.admin.id,
        admin_email: access.admin.email,
        action: "duplicate_attempt",
        notes: "Ticket was scanned again while already checked in."
      });

      const { data: existingTicket, error: existingTicketError } =
        await supabaseAdmin
          .from("tickets")
          .select(`
            id,
            ticket_code,
            status,
            checked_in_at,
            checked_out_at,
            teams:assigned_team_id (
              id,
              code,
              name
            )
          `)
          .eq("id", ticket.id)
          .single();

      if (existingTicketError || !existingTicket) {
        return NextResponse.json(
          { error: "Ticket is already checked in, but could not reload details." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Already checked in.",
        alreadyCheckedIn: true,
        ticket: existingTicket
      });
    }

    await assignTeam(ticket.id);

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("tickets")
      .update({
        checked_in_at: now,
        checked_out_at: null
      })
      .eq("id", ticket.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Could not check in ticket." },
        { status: 500 }
      );
    }

    const { data: updatedTicket, error: refetchError } = await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        ticket_code,
        status,
        checked_in_at,
        checked_out_at,
        teams:assigned_team_id (
          id,
          code,
          name
        )
      `)
      .eq("id", ticket.id)
      .single();

    if (refetchError || !updatedTicket) {
      return NextResponse.json(
        { error: "Ticket checked in, but could not reload team assignment." },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("checkin_logs").insert({
      ticket_id: ticket.id,
      attendee_id: ticket.attendee_id,
      event_id: ticket.event_id,
      admin_user_id: access.admin.id,
      admin_email: access.admin.email,
      action: "check_in",
      notes: "Ticket checked in."
    });

    return NextResponse.json({
      message: "Checked in successfully.",
      ticket: updatedTicket
    });
  } catch (error) {
    console.error("Check-in error:", error);

    return NextResponse.json(
      { error: "Unexpected check-in error." },
      { status: 500 }
    );
  }
}