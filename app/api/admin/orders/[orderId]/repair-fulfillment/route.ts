import {
  NextRequest,
  NextResponse
} from "next/server";

import { requireManagerForEvent } from "@/lib/auth/require-manager-for-event";
import { logAdminActivity } from "@/lib/admin/log-admin-activity";
import { fulfillPaidOrder } from "@/lib/payments/fulfill-paid-order";
import { supabaseAdmin } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  const { orderId } = await context.params;

  let order:
    | {
        id: string;
        event_id: string;
        status: string;
        public_reference: string | null;
      }
    | null = null;

  let authorization:
    | Awaited<ReturnType<typeof requireManagerForEvent>>
    | null = null;

  try {
    const {
      data,
      error
    } = await supabaseAdmin
      .from("registration_orders")
      .select(`
        id,
        event_id,
        status,
        public_reference
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error("Repair order lookup failed:", error);

      return NextResponse.json(
        { error: "Could not load registration order." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Registration order not found." },
        { status: 404 }
      );
    }

    order = data;

    authorization = await requireManagerForEvent(
      order.event_id
    );

    if (!authorization.allowed) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status }
      );
    }

    if (order.status !== "paid") {
      await logAdminActivity({
        adminUserId: authorization.admin.id,
        adminEmail: authorization.admin.email,
        eventId: order.event_id,
        action: "order_fulfillment_failed",
        outcome: "denied",
        notes:
          "Fulfillment repair was rejected because the order is not paid.",
        metadata: {
          orderId: order.id,
          publicReference: order.public_reference,
          orderStatus: order.status
        }
      });

      return NextResponse.json(
        {
          error:
            "Only paid registration orders can be fulfilled."
        },
        { status: 400 }
      );
    }

    /*
     * Inspect the pre-repair state for the audit record.
     */
    const [
      attendeesResult,
      ticketsBeforeResult
    ] = await Promise.all([
      supabaseAdmin
        .from("attendees")
        .select("id")
        .eq("order_id", order.id),

      supabaseAdmin
        .from("tickets")
        .select(`
          id,
          status,
          email_sent_at
        `)
        .eq("order_id", order.id)
    ]);

    if (
      attendeesResult.error ||
      ticketsBeforeResult.error
    ) {
      throw new Error(
        attendeesResult.error?.message ??
          ticketsBeforeResult.error?.message ??
          "Could not inspect fulfillment state."
      );
    }

    const attendeeCount =
      attendeesResult.data?.length ?? 0;

    const ticketsBefore =
      ticketsBeforeResult.data ?? [];

    const validTicketsBefore =
      ticketsBefore.filter(
        (ticket) => ticket.status === "valid"
      ).length;

    const invalidTicketsBefore =
      ticketsBefore.filter(
        (ticket) => ticket.status !== "valid"
      ).length;

    /*
     * Do not allow automatic repair when an invalid ticket exists.
     * Invalid tickets may have been intentionally revoked.
     */
    if (invalidTicketsBefore > 0) {
      await logAdminActivity({
        adminUserId: authorization.admin.id,
        adminEmail: authorization.admin.email,
        eventId: order.event_id,
        action: "order_fulfillment_failed",
        outcome: "denied",
        notes:
          "Automatic repair was rejected because the order contains an invalid ticket.",
        metadata: {
          orderId: order.id,
          publicReference: order.public_reference,
          attendeeCount,
          validTicketsBefore,
          invalidTicketsBefore
        }
      });

      return NextResponse.json(
        {
          error:
            "This order contains an invalidated ticket. Review it manually before restoring or replacing any ticket."
        },
        { status: 409 }
      );
    }

    const fulfillment =
      await fulfillPaidOrder(order.id);

    await logAdminActivity({
      adminUserId: authorization.admin.id,
      adminEmail: authorization.admin.email,
      eventId: order.event_id,
      action: "order_fulfillment_repaired",
      outcome:
        fulfillment.complete &&
        fulfillment.email.failures.length === 0
          ? "success"
          : "failure",
      notes:
        fulfillment.email.failures.length === 0
          ? "Paid-order fulfillment repair completed."
          : "Tickets were fulfilled, but one or more ticket emails remain unsent.",
      metadata: {
        orderId: order.id,
        publicReference: order.public_reference,

        attendeeCount,

        validTicketsBefore,
        ticketsCreated:
          fulfillment.ticketsCreated,
        validTicketsAfter:
          fulfillment.validTicketCount,

        emailsSent:
          fulfillment.email.sent,
        emailsAlreadySent:
          fulfillment.email.alreadySent,
        emailsClaimedElsewhere:
          fulfillment.email.claimedElsewhere,
        emailFailures:
          fulfillment.email.failures.length
      }
    });

    return NextResponse.json({
      success: true,
      fulfillment
    });
  } catch (error) {
    console.error(
      "Order fulfillment repair failed:",
      {
        orderId,
        error
      }
    );

    if (
      order &&
      authorization?.allowed
    ) {
      await logAdminActivity({
        adminUserId: authorization.admin.id,
        adminEmail: authorization.admin.email,
        eventId: order.event_id,
        action: "order_fulfillment_failed",
        outcome: "failure",
        notes:
          error instanceof Error
            ? error.message
            : "Unknown fulfillment repair failure.",
        metadata: {
          orderId: order.id,
          publicReference: order.public_reference
        }
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not repair order fulfillment."
      },
      { status: 500 }
    );
  }
}