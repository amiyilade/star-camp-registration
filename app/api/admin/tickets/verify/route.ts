import { NextRequest, NextResponse } from "next/server";

import { requireAdminForEvent } from "@/lib/auth/require-admin-for-event";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const ticketCode = request.nextUrl.searchParams.get("ticketCode");

  if (!token && !ticketCode) {
    return NextResponse.json(
      { error: "Ticket token or ticket code is required." },
      { status: 400 }
    );
  }

  const query = supabaseAdmin
    .from("tickets")
    .select(`
      id,
      ticket_code,
      qr_token,
      status,
      checked_in_at,
      checked_out_at,
      attendee_id,
      event_id,
      order_id,
      registration_orders!inner (
        status
      ),
      attendees (
        first_name,
        last_name,
        email,
        phone_country_code,
        phone_number,
        gender,
        date_of_birth,
        age_at_registration,
        department,
        residence_area,
        guardian_name,
        guardian_phone_country_code,
        guardian_phone_number,
        emergency_contact_name,
        emergency_contact_phone_country_code,
        emergency_contact_phone_number
      ),
      events (
        name,
        location,
        slug,
        date_start,
        date_end
      ),
      teams:assigned_team_id (
        id,
        code,
        name
      )
    `);

  const { data: ticket, error } = token
    ? await query.eq("qr_token", token).single()
    : await query.eq("ticket_code", ticketCode).single();

  if (error || !ticket) {
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

  if (order?.status !== "paid" || ticket.status !== "valid") {
    await supabaseAdmin.from("checkin_logs").insert({
      ticket_id: ticket.id,
      attendee_id: ticket.attendee_id,
      event_id: ticket.event_id,
      admin_user_id: access.admin.id,
      admin_email: access.admin.email,
      action: "duplicate_attempt",
      notes: `Ticket verification rejected. Order status: ${
        order?.status ?? "unknown"
      }; ticket status: ${ticket.status}.`
    });

    return NextResponse.json(
      {
        error:
          order?.status !== "paid"
            ? `Ticket is not valid for entry. Payment status: ${
                order?.status ?? "unknown"
              }.`
            : `Ticket is not valid for entry. Ticket status: ${ticket.status}.`
      },
      { status: 400 }
    );
  }

  await supabaseAdmin.from("checkin_logs").insert({
    ticket_id: ticket.id,
    attendee_id: ticket.attendee_id,
    event_id: ticket.event_id,
    admin_user_id: access.admin.id,
    admin_email: access.admin.email,
    action: "verify",
    notes: "Ticket verified from admin scanner."
  });

  return NextResponse.json({
    ticket
  });
}