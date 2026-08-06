import crypto from "crypto";
import {
  NextRequest,
  NextResponse
} from "next/server";

import {
  fulfillPaidOrder
} from "@/lib/payments/fulfill-paid-order";

import {
  validatePaystackTransaction
} from "@/lib/payments/validate-paystack-transaction";

import { supabaseAdmin } from "@/lib/supabase/server";

function verifyPaystackSignature(
  rawBody: string,
  signature: string | null
) {
  if (!signature) {
    return false;
  }

  const secretKey =
    process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "Missing PAYSTACK_SECRET_KEY"
    );
  }

  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");

  return hash === signature;
}

export async function POST(
  request: NextRequest
) {
  try {
    const rawBody = await request.text();

    const signature = request.headers.get(
      "x-paystack-signature"
    );

    if (
      !verifyPaystackSignature(
        rawBody,
        signature
      )
    ) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    const paystackEvent = JSON.parse(rawBody);

    if (
      paystackEvent.event !== "charge.success"
    ) {
      return NextResponse.json({
        received: true
      });
    }

    const transaction = paystackEvent.data;

    const reference =
      transaction?.reference;

    if (!reference) {
      return NextResponse.json(
        {
          error:
            "Missing transaction reference."
        },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } =
      await supabaseAdmin
        .from("registration_orders")
        .select(`
          id,
          public_reference,
          status,
          total_amount_ngn,
          paystack_reference
        `)
        .eq("paystack_reference", reference)
        .single();

    if (orderError || !order) {
      console.error(
        "Webhook order lookup error:",
        orderError
      );

      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    try {
      validatePaystackTransaction({
        transaction,
        expectedReference:
          order.paystack_reference,
        expectedAmountNgn:
          order.total_amount_ngn
      });
    } catch (error) {
      console.error(
        "Webhook transaction validation failed:",
        {
          reference,
          error
        }
      );

      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Payment validation failed."
        },
        { status: 400 }
      );
    }

    if (order.status !== "paid") {
      const { error: updateError } =
        await supabaseAdmin
          .from("registration_orders")
          .update({
            status: "paid",
            paid_at:
              transaction.paid_at ??
              new Date().toISOString()
          })
          .eq("id", order.id)
          .neq("status", "paid");

      if (updateError) {
        console.error(
          "Webhook payment update error:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              "Could not update order payment status."
          },
          { status: 500 }
        );
      }
    }

    const fulfillment =
      await fulfillPaidOrder(order.id);

    return NextResponse.json({
      received: true,
      publicReference:
        order.public_reference,
      fulfillment
    });
  } catch (error) {
    console.error(
      "Paystack webhook error:",
      error
    );

    return NextResponse.json(
      { error: "Webhook handler failed." },
      { status: 500 }
    );
  }
}