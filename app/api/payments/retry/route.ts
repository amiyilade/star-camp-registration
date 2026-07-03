import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { initializePaystackTransaction } from "@/lib/paystack";
import { generatePaystackReference } from "@/lib/generate-paystack-reference";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const publicReference = body.publicReference as string | undefined;

  if (!publicReference) {
    return NextResponse.json(
      { error: "Registration reference is required." },
      { status: 400 }
    );
  }

  const { data: order, error } = await supabaseAdmin
    .from("registration_orders")
    .select(`
      id,
      public_reference,
      buyer_email,
      total_amount_ngn,
      status
    `)
    .eq("public_reference", publicReference)
    .single();

  if (error || !order) {
    return NextResponse.json(
      { error: "Registration order not found." },
      { status: 404 }
    );
  }

  if (order.status === "paid") {
    return NextResponse.json(
      { error: "This registration has already been paid." },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const paystackReference = generatePaystackReference(order.public_reference);

  const paystack = await initializePaystackTransaction({
    email: order.buyer_email,
    amountKobo: order.total_amount_ngn * 100,
    reference: paystackReference,
    callbackUrl: `${appUrl}/payment/callback`,
    metadata: {
      order_id: order.id,
      public_reference: order.public_reference,
      retry: true
    }
  });

  const { error: updateError } = await supabaseAdmin
    .from("registration_orders")
    .update({
      status: "pending_payment",
      paystack_reference: paystackReference,
      paystack_authorization_url: paystack.authorization_url
    })
    .eq("id", order.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Could not prepare retry payment." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    paymentUrl: paystack.authorization_url
  });
}