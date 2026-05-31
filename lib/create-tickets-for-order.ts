import { supabaseAdmin } from "@/lib/supabase/server";
import { generateQrToken, generateTicketCode } from "@/lib/tickets";

export async function createTicketsForPaidOrder(orderId: string) {
  const { data: existingTickets, error: existingError } = await supabaseAdmin
    .from("tickets")
    .select("id")
    .eq("order_id", orderId);

  if (existingError) {
    throw existingError;
  }

  if (existingTickets && existingTickets.length > 0) {
    return {
      created: false,
      reason: "Tickets already exist."
    };
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("registration_orders")
    .select(`
      id,
      event_id,
      events (
        slug
      )
    `)
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw orderError ?? new Error("Order not found.");
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

  const { data: attendees, error: attendeesError } = await supabaseAdmin
    .from("attendees")
    .select("id")
    .eq("order_id", orderId);

  if (attendeesError) {
    throw attendeesError;
  }

  if (!attendees || attendees.length === 0) {
    throw new Error("No attendees found for this order.");
  }

  const ticketsToInsert = attendees.map((attendee) => ({
    order_id: order.id,
    attendee_id: attendee.id,
    event_id: order.event_id,
    ticket_code: generateTicketCode(eventSlug),
    qr_token: generateQrToken(),
    status: "valid"
  }));

  const { data: tickets, error: ticketError } = await supabaseAdmin
    .from("tickets")
    .insert(ticketsToInsert)
    .select("id, ticket_code, qr_token, attendee_id");

  if (ticketError) {
    throw ticketError;
  }

  return {
    created: true,
    tickets
  };
}