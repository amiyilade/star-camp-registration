import { supabaseAdmin } from "@/lib/supabase/server";
import {
  generateQrToken,
  generateTicketCode
} from "@/lib/tickets";

type CreatedTicket = {
  id: string;
  attendee_id: string;
  ticket_code: string;
  qr_token: string;
  status: string;
};

export async function createTicketsForPaidOrder(
  orderId: string
) {
  const { data: order, error: orderError } =
    await supabaseAdmin
      .from("registration_orders")
      .select(`
        id,
        event_id,
        status,
        ticket_quantity,
        events (
          slug
        )
      `)
      .eq("id", orderId)
      .single();

  if (orderError || !order) {
    throw orderError ?? new Error("Order not found.");
  }

  if (order.status !== "paid") {
    throw new Error(
      "Tickets can only be generated for a paid order."
    );
  }

  const eventRelation = order.events as
    | { slug: string }
    | { slug: string }[]
    | null;

  const eventSlug = Array.isArray(eventRelation)
    ? eventRelation[0]?.slug
    : eventRelation?.slug;

  if (!eventSlug) {
    throw new Error("Event slug not found.");
  }

  const { data: attendees, error: attendeesError } =
    await supabaseAdmin
      .from("attendees")
      .select("id")
      .eq("order_id", order.id)
      .eq("event_id", order.event_id);

  if (attendeesError) {
    throw attendeesError;
  }

  if (!attendees || attendees.length === 0) {
    throw new Error("No attendees found for this order.");
  }

  if (attendees.length !== order.ticket_quantity) {
    throw new Error(
      `Order attendee count mismatch. Expected ${order.ticket_quantity}, found ${attendees.length}.`
    );
  }

  const attendeeIds = attendees.map(
    (attendee) => attendee.id
  );

  const { data: existingTickets, error: existingError } =
    await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        attendee_id,
        ticket_code,
        qr_token,
        status
      `)
      .in("attendee_id", attendeeIds);

  if (existingError) {
    throw existingError;
  }

  const existingAttendeeIds = new Set(
    (existingTickets ?? []).map(
      (ticket) => ticket.attendee_id
    )
  );

  const missingAttendees = attendees.filter(
    (attendee) =>
      !existingAttendeeIds.has(attendee.id)
  );

  if (missingAttendees.length > 0) {
    const ticketRows = missingAttendees.map(
      (attendee) => ({
        order_id: order.id,
        attendee_id: attendee.id,
        event_id: order.event_id,
        ticket_code: generateTicketCode(eventSlug),
        qr_token: generateQrToken(),
        status: "valid"
      })
    );

    /*
     * attendee_id has a UNIQUE constraint.
     *
     * ignoreDuplicates makes concurrent webhook and verification
     * requests safe: whichever request inserts first wins, while the
     * other request does not create duplicate tickets.
     */
    const { error: insertError } = await supabaseAdmin
      .from("tickets")
      .upsert(ticketRows, {
        onConflict: "attendee_id",
        ignoreDuplicates: true
      });

    if (insertError) {
      throw insertError;
    }
  }

  /*
   * Re-read the final state after insertion. This also picks up rows
   * inserted concurrently by another fulfillment request.
   */
  const { data: finalTickets, error: finalError } =
    await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        attendee_id,
        ticket_code,
        qr_token,
        status
      `)
      .in("attendee_id", attendeeIds);

  if (finalError) {
    throw finalError;
  }

  const tickets = (finalTickets ?? []) as CreatedTicket[];

  const validTicketCount = tickets.filter(
    (ticket) => ticket.status === "valid"
  ).length;

  if (validTicketCount !== attendees.length) {
    throw new Error(
      `Ticket fulfillment incomplete. Expected ${attendees.length} valid tickets, found ${validTicketCount}.`
    );
  }

  const existingCount = existingTickets?.length ?? 0;

  return {
    orderId: order.id,
    eventId: order.event_id,
    attendeeCount: attendees.length,
    existingTicketCount: existingCount,
    ticketsCreated: Math.max(
      tickets.length - existingCount,
      0
    ),
    validTicketCount,
    tickets
  };
}