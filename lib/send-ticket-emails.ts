import { Resend } from "resend";
import QRCode from "qrcode";

import { supabaseAdmin } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function resolveRecipient(email: string) {
  if (
    process.env.EMAIL_MODE === "test" &&
    process.env.TEST_EMAIL
  ) {
    return process.env.TEST_EMAIL;
  }

  return email;
}

export async function sendTicketEmails(orderId: string) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const fromEmail =
    process.env.TICKET_FROM_EMAIL ??
    "STAR Camp <onboarding@resend.dev>";

  const { data: order, error: orderError } =
    await supabaseAdmin
      .from("registration_orders")
      .select(`
        id,
        public_reference,
        buyer_email,
        attendees (
          id,
          first_name,
          last_name,
          email
        ),
        tickets (
          id,
          attendee_id,
          ticket_code,
          qr_token,
          email_sent_at
        ),
        events (
          name,
          location,
          slug,
          date_start,
          date_end
        )
      `)
      .eq("id", orderId)
      .single();

  if (orderError || !order) {
    throw orderError ?? new Error("Order not found.");
  }

  const attendees = Array.isArray(order.attendees)
    ? order.attendees
    : [];

  const tickets = Array.isArray(order.tickets)
    ? order.tickets
    : [];

  const event = Array.isArray(order.events)
    ? order.events[0]
    : order.events;

  for (const attendee of attendees) {
    const ticket = tickets.find(
      (item) => item.attendee_id === attendee.id
    );

    if (!ticket) {
      console.warn(
        `No ticket found for attendee ${attendee.id}`
      );

      continue;
    }

    if (ticket.email_sent_at) {
      continue;
    }

    // Claim this ticket email send attempt.
    // This prevents duplicate sends if webhook + verify run at the same time.
    const { data: claimedTicket, error: claimError } = await supabaseAdmin
      .from("tickets")
      .update({
        email_send_started_at: new Date().toISOString()
      })
      .eq("id", ticket.id)
      .is("email_sent_at", null)
      .is("email_send_started_at", null)
      .select("id")
      .single();

    if (claimError || !claimedTicket) {
      console.warn(
        `Ticket ${ticket.id} email already claimed or sent. Skipping.`
      );
      continue;
    }

    const recipientEmail =
      attendee.email?.trim().toLowerCase() ||
      order.buyer_email;

    const ticketUrl =
      `${appUrl}/tickets/${ticket.qr_token}`;

    const qrCodeBuffer = await QRCode.toBuffer(ticketUrl, {
    type: "png",
    margin: 2,
    width: 320
    });

    const attendeeName =
      `${attendee.first_name} ${attendee.last_name}`;

    const eventDate =
      event?.date_start && event?.date_end
        ? `${event.date_start} to ${event.date_end}`
        : "Date to be announced";

    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: resolveRecipient(recipientEmail),
      subject: `${event?.name ?? "STAR Camp"} Ticket Confirmation`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #1f1f1f;">
          
          <h1 style="color: #4f46e5;">
            Registration Confirmed
          </h1>

          <p>
            Hello ${attendeeName},
          </p>

          <p>
            Your registration for <strong>${event?.name}</strong> has been confirmed.
          </p>

          <div style="margin: 24px 0; padding: 20px; border-radius: 18px; background: #f5f3ff;">
            <p><strong>Ticket Code:</strong> ${ticket.ticket_code}</p>
            <p><strong>Location:</strong> ${event?.location}</p>
            <p><strong>Date:</strong> ${eventDate}</p>
            <p><strong>Reference:</strong> ${order.public_reference}</p>
          </div>

          <div style="margin: 32px 0;">
            <img
            src="cid:ticket-qr-${ticket.id}"
            alt="Ticket QR Code"
            width="240"
            height="240"
            />
          </div>

          <p>
            Please keep this QR code safe. It will be scanned at check-in.
          </p>

          <p>
            You can also open your ticket here:
          </p>

          <p>
            <a href="${ticketUrl}">
              ${ticketUrl}
            </a>
          </p>

          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />

          <p style="font-size: 14px; color: #6b7280;">
            STAR Camp Registration System
          </p>
        </div>
      `,
      attachments: [
        {
            filename: `${ticket.ticket_code}.png`,
            content: qrCodeBuffer,
            contentType: "image/png",
            contentId: `ticket-qr-${ticket.id}`
        }
        ]
    });

    if (emailResult.error) {
        console.error("Resend email error:", emailResult.error);
        continue;
        }

    if (!emailResult.data?.id) {
        console.error("Resend email did not return an email id:", emailResult);
        continue;
    }

    const { error: updateError } =
      await supabaseAdmin
        .from("tickets")
        .update({
          email_sent_at: new Date().toISOString(),
          email_send_started_at: null
        })
        .eq("id", ticket.id);

    if (updateError) {
      console.error(
        "Could not update ticket email_sent_at:",
        updateError
      );
    }
  }
}

export async function resendSingleTicketEmail(ticketId: string) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const fromEmail =
    process.env.TICKET_FROM_EMAIL ??
    "STAR Camp <onboarding@resend.dev>";

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("tickets")
    .select(`
      id,
      ticket_code,
      qr_token,
      attendee_id,
      email_sent_at,
      attendees (
        first_name,
        last_name,
        email
      ),
      registration_orders (
        buyer_email,
        public_reference
      ),
      events (
        name,
        location,
        slug,
        date_start,
        date_end
      )
    `)
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticket) {
    throw ticketError ?? new Error("Ticket not found.");
  }

  const attendee = Array.isArray(ticket.attendees)
    ? ticket.attendees[0]
    : ticket.attendees;

  const order = Array.isArray(ticket.registration_orders)
    ? ticket.registration_orders[0]
    : ticket.registration_orders;

  const event = Array.isArray(ticket.events)
    ? ticket.events[0]
    : ticket.events;

  if (!attendee) {
    throw new Error("Ticket attendee not found.");
  }

  const recipientEmail =
    attendee.email?.trim().toLowerCase() ||
    order?.buyer_email;

  if (!recipientEmail) {
    throw new Error("No recipient email available for this ticket.");
  }

  const attendeeName =
    `${attendee.first_name} ${attendee.last_name}`;

  const ticketUrl =
    `${appUrl}/tickets/${ticket.qr_token}`;

  const eventDate =
    event?.date_start && event?.date_end
      ? `${event.date_start} to ${event.date_end}`
      : "Date to be announced";

  const qrCodeBuffer = await QRCode.toBuffer(ticketUrl, {
    type: "png",
    margin: 2,
    width: 320
  });

  const emailResult = await resend.emails.send({
    from: fromEmail,
    to: resolveRecipient(recipientEmail),
    subject: `${event?.name ?? "STAR Camp"} Ticket Confirmation`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #1f1f1f;">
        <h1 style="color: #4f46e5;">
          Registration Confirmed
        </h1>

        <p>
          Hello ${attendeeName},
        </p>

        <p>
          Your registration for <strong>${event?.name ?? "STAR Camp"}</strong> has been confirmed.
        </p>

        <div style="margin: 24px 0; padding: 20px; border-radius: 18px; background: #f5f3ff;">
          <p><strong>Ticket Code:</strong> ${ticket.ticket_code}</p>
          <p><strong>Location:</strong> ${event?.location ?? "Event venue"}</p>
          <p><strong>Date:</strong> ${eventDate}</p>
          ${
            order?.public_reference
              ? `<p><strong>Reference:</strong> ${order.public_reference}</p>`
              : ""
          }
        </div>

        <div style="margin: 32px 0;">
          <img
            src="cid:ticket-qr-${ticket.id}"
            alt="Ticket QR Code"
            width="240"
            height="240"
          />
        </div>

        <p>
          Please keep this QR code safe. It will be scanned at check-in.
        </p>

        <p>
          You can also open your ticket here:
        </p>

        <p>
          <a href="${ticketUrl}">
            ${ticketUrl}
          </a>
        </p>

        <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />

        <p style="font-size: 14px; color: #6b7280;">
          STAR Camp Registration System
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `${ticket.ticket_code}.png`,
        content: qrCodeBuffer,
        contentType: "image/png",
        contentId: `ticket-qr-${ticket.id}`
      }
    ]
  });

  if (emailResult.error) {
    throw new Error(emailResult.error.message);
  }

  if (!emailResult.data?.id) {
    throw new Error("Resend did not return an email ID.");
  }

  await supabaseAdmin
    .from("tickets")
    .update({
      last_resent_at: new Date().toISOString()
    })
    .eq("id", ticket.id);

  return emailResult.data;
}