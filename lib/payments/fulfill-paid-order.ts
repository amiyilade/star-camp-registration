import {
  createTicketsForPaidOrder
} from "@/lib/create-tickets-for-order";

import {
  sendTicketEmails
} from "@/lib/send-ticket-emails";

import { supabaseAdmin } from "@/lib/supabase/server";

export async function fulfillPaidOrder(orderId: string) {
  const { data: order, error: orderError } =
    await supabaseAdmin
      .from("registration_orders")
      .select(`
        id,
        event_id,
        status,
        public_reference,
        ticket_quantity
      `)
      .eq("id", orderId)
      .single();

  if (orderError || !order) {
    throw orderError ?? new Error("Order not found.");
  }

  if (order.status !== "paid") {
    throw new Error(
      "Only paid orders can be fulfilled."
    );
  }

  const ticketResult =
    await createTicketsForPaidOrder(order.id);

  let emailResult: Awaited<
    ReturnType<typeof sendTicketEmails>
  >;

  try {
    emailResult = await sendTicketEmails(order.id);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown ticket-email error.";

    console.error(
      "Order tickets were created but ticket email processing failed:",
      {
        orderId: order.id,
        error
      }
    );

    emailResult = {
      orderId: order.id,
      attendeeCount: ticketResult.attendeeCount,
      sent: 0,
      alreadySent: 0,
      claimedElsewhere: 0,
      missingTickets: 0,
      failures: [
        {
          ticketId: "",
          attendeeId: "",
          message
        }
      ]
    };
  }

  return {
    orderId: order.id,
    eventId: order.event_id,
    publicReference: order.public_reference,
    attendeeCount: ticketResult.attendeeCount,
    ticketsCreated: ticketResult.ticketsCreated,
    validTicketCount: ticketResult.validTicketCount,
    email: emailResult,
    complete:
      ticketResult.validTicketCount ===
      ticketResult.attendeeCount
  };
}