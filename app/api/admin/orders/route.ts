import { NextRequest, NextResponse } from "next/server";

import { getManagedEvents } from "@/lib/auth/get-managed-events";
import { supabaseAdmin } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

function getRelationArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export async function GET(request: NextRequest) {
  try {
    const { admin, events } = await getManagedEvents();

    if (!admin) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    if (events.length === 0) {
      return NextResponse.json(
        {
          error:
            "Manager access is required to view registration orders."
        },
        { status: 403 }
      );
    }

    const requestedEventSlug =
      request.nextUrl.searchParams.get("eventSlug")?.trim() ?? "all";

    const status =
      request.nextUrl.searchParams.get("status")?.trim() ?? "all";

    const issue =
      request.nextUrl.searchParams.get("issue")?.trim() ?? "all";

    const search =
      request.nextUrl.searchParams.get("search")?.trim() ?? "";

    const requestedPage = Number(
      request.nextUrl.searchParams.get("page") ?? "1"
    );

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const selectedEvents =
      requestedEventSlug === "all"
        ? events
        : events.filter(
            (event) => event.slug === requestedEventSlug
          );

    if (selectedEvents.length === 0) {
      return NextResponse.json(
        {
          error:
            "You do not have manager access to the selected event."
        },
        { status: 403 }
      );
    }

    const allowedEventIds = selectedEvents.map((event) => event.id);

    let query = supabaseAdmin
      .from("registration_orders")
      .select(
        `
          id,
          event_id,
          public_reference,
          buyer_full_name,
          buyer_email,
          buyer_phone_country_code,
          buyer_phone_number,
          ticket_quantity,
          unit_price_ngn,
          total_amount_ngn,
          status,
          paystack_reference,
          paid_at,
          created_at,
          events (
            id,
            name,
            slug,
            location
          ),
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
            status,
            email_sent_at,
            email_send_started_at,
            created_at
          )
        `,
        {
          count: "exact"
        }
      )
      .in("event_id", allowedEventIds)
      .order("created_at", {
        ascending: false
      });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (search.length >= 2) {
      const normalizedSearch = search
        .replaceAll(",", " ")
        .replaceAll("(", " ")
        .replaceAll(")", " ")
        .trim();

      query = query.or(
        [
          `public_reference.ilike.%${normalizedSearch}%`,
          `buyer_full_name.ilike.%${normalizedSearch}%`,
          `buyer_email.ilike.%${normalizedSearch}%`,
          `buyer_phone_number.ilike.%${normalizedSearch}%`,
          `paystack_reference.ilike.%${normalizedSearch}%`
        ].join(",")
      );
    }

    /*
     * Fulfillment-issue filtering is performed after aggregation because
     * it depends on attendee and ticket counts. To avoid excluding issue
     * rows prematurely, retrieve a larger bounded set when an issue
     * filter is active.
     */
    if (issue === "all") {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      query = query.range(from, to);
    } else {
      query = query.limit(250);
    }

    const {
      data,
      error,
      count
    } = await query;

    if (error) {
      console.error("Orders query failed:", error);

      return NextResponse.json(
        { error: "Could not load registration orders." },
        { status: 500 }
      );
    }

    const mappedOrders = (data ?? []).map((order) => {
      const attendees = getRelationArray(order.attendees);
      const tickets = getRelationArray(order.tickets);

      const validTickets = tickets.filter(
        (ticket) => ticket.status === "valid"
      );

      const invalidTickets = tickets.filter(
        (ticket) => ticket.status !== "valid"
      );

      const attendeeCount = attendees.length;
      const totalTicketCount = tickets.length;
      const validTicketCount = validTickets.length;
      const invalidTicketCount = invalidTickets.length;

      /*
       * Use total ticket rows here, not valid ticket rows. An invalid
       * ticket is not "missing" and should not be recreated automatically.
       */
      const missingTicketCount = Math.max(
        attendeeCount - totalTicketCount,
        0
      );

      const unsentEmailCount = validTickets.filter(
        (ticket) => !ticket.email_sent_at
      ).length;

      const claimedEmailCount = validTickets.filter(
        (ticket) =>
          !ticket.email_sent_at &&
          Boolean(ticket.email_send_started_at)
      ).length;

      const isPaid = order.status === "paid";

      let fulfillmentState:
        | "not_applicable"
        | "complete"
        | "missing_tickets"
        | "emails_pending"
        | "missing_tickets_and_emails_pending"
        | "invalid_tickets";

      if (!isPaid) {
        fulfillmentState = "not_applicable";
      } else if (invalidTicketCount > 0) {
        fulfillmentState = "invalid_tickets";
      } else if (
        missingTicketCount > 0 &&
        unsentEmailCount > 0
      ) {
        fulfillmentState =
          "missing_tickets_and_emails_pending";
      } else if (missingTicketCount > 0) {
        fulfillmentState = "missing_tickets";
      } else if (unsentEmailCount > 0) {
        fulfillmentState = "emails_pending";
      } else {
        fulfillmentState = "complete";
      }

      const event = Array.isArray(order.events)
        ? order.events[0]
        : order.events;

      return {
        id: order.id,
        eventId: order.event_id,
        publicReference: order.public_reference,

        buyerFullName: order.buyer_full_name,
        buyerEmail: order.buyer_email,
        buyerPhone:
          `${order.buyer_phone_country_code}${order.buyer_phone_number}`,

        ticketQuantity: order.ticket_quantity,
        unitPriceNgn: order.unit_price_ngn,
        totalAmountNgn: order.total_amount_ngn,

        status: order.status,
        paystackReference: order.paystack_reference,
        paidAt: order.paid_at,
        createdAt: order.created_at,

        event,

        attendees: attendees.map((attendee) => ({
          id: attendee.id,
          firstName: attendee.first_name,
          lastName: attendee.last_name,
          email: attendee.email
        })),

        fulfillment: {
          state: fulfillmentState,
          attendeeCount,
          totalTicketCount,
          validTicketCount,
          invalidTicketCount,
          missingTicketCount,
          unsentEmailCount,
          claimedEmailCount
        }
      };
    });

    const issueFilteredOrders = mappedOrders.filter((order) => {
      if (issue === "all") {
        return true;
      }

      if (issue === "missing_tickets") {
        return (
          order.status === "paid" &&
          order.fulfillment.missingTicketCount > 0
        );
      }

      if (issue === "emails_pending") {
        return (
          order.status === "paid" &&
          order.fulfillment.unsentEmailCount > 0
        );
      }

      if (issue === "invalid_tickets") {
        return (
          order.status === "paid" &&
          order.fulfillment.invalidTicketCount > 0
        );
      }

      if (issue === "needs_attention") {
        return (
          order.status === "paid" &&
          order.fulfillment.state !== "complete"
        );
      }

      return true;
    });

    const paginatedOrders =
      issue === "all"
        ? issueFilteredOrders
        : issueFilteredOrders.slice(
            (page - 1) * PAGE_SIZE,
            page * PAGE_SIZE
          );

    const total =
      issue === "all"
        ? count ?? 0
        : issueFilteredOrders.length;

    return NextResponse.json({
      orders: paginatedOrders,

      events: events.map((event) => ({
        id: event.id,
        name: event.name,
        slug: event.slug,
        location: event.location
      })),

      viewer: {
        isSuperAdmin: admin.is_super_admin
      },

      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(
          1,
          Math.ceil(total / PAGE_SIZE)
        )
      }
    });
  } catch (error) {
    console.error("Orders API error:", error);

    return NextResponse.json(
      { error: "Unexpected orders error." },
      { status: 500 }
    );
  }
}