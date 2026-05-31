import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createTicketsForPaidOrder } from "@/lib/create-tickets-for-order";
import { sendTicketEmails } from "@/lib/send-ticket-emails";

function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;

  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing PAYSTACK_SECRET_KEY");
  }

  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");

  return hash === signature;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    const isValidSignature = verifyPaystackSignature(rawBody, signature);

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawBody);

    if (event.event !== "charge.success") {
      return NextResponse.json({ received: true });
    }

    const transaction = event.data;
    const reference = transaction.reference;

    if (!reference) {
      return NextResponse.json(
        { error: "Missing transaction reference." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("registration_orders")
      .select("id, public_reference, status, total_amount_ngn, paystack_reference")
      .eq("paystack_reference", reference)
      .single();

    if (orderError || !order) {
      console.error("Webhook order lookup error:", orderError);

      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.status === "paid") {
      return NextResponse.json({
        received: true,
        message: "Order already paid."
      });
    }

    const amountFromPaystackKobo = transaction.amount;
    const expectedAmountKobo = order.total_amount_ngn * 100;

    if (amountFromPaystackKobo !== expectedAmountKobo) {
      console.error("Amount mismatch:", {
        reference,
        expectedAmountKobo,
        amountFromPaystackKobo
      });

      return NextResponse.json(
        { error: "Payment amount mismatch." },
        { status: 400 }
      );
    }

    if (transaction.status !== "success") {
      return NextResponse.json(
        { error: "Transaction was not successful." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("registration_orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString()
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("Webhook payment update error:", updateError);

      return NextResponse.json(
        { error: "Could not update order payment status." },
        { status: 500 }
      );
    }

    const ticketResult = await createTicketsForPaidOrder(order.id);
    await sendTicketEmails(order.id);

    console.log("Ticket generation result:", ticketResult);

    return NextResponse.json({
      received: true,
      publicReference: order.public_reference
    });
  } catch (error) {
    console.error("Paystack webhook error:", error);

    return NextResponse.json(
      { error: "Webhook handler failed." },
      { status: 500 }
    );
  }
}