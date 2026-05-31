import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const reference =
      request.nextUrl.searchParams.get("reference");

    if (!reference) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing payment reference."
        },
        { status: 400 }
      );
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing Paystack secret key."
        },
        { status: 500 }
      );
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`
        }
      }
    );

    const paystackData = await paystackResponse.json();

    if (
      !paystackResponse.ok ||
      !paystackData.status
    ) {
      console.error("Paystack verify error:", paystackData);

      return NextResponse.json(
        {
          success: false,
          error: "Could not verify payment."
        },
        { status: 400 }
      );
    }

    const transaction = paystackData.data;

    if (transaction.status !== "success") {
      return NextResponse.json(
        {
          success: false,
          error: "Payment was not successful."
        },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } =
      await supabaseAdmin
        .from("registration_orders")
        .select("id, public_reference, status")
        .eq("paystack_reference", reference)
        .single();

    if (orderError || !order) {
      console.error("Order lookup error:", orderError);

      return NextResponse.json(
        {
          success: false,
          error: "Registration order not found."
        },
        { status: 404 }
      );
    }

    if (order.status === "paid") {
      return NextResponse.json({
        success: true,
        publicReference: order.public_reference
      });
    }

    const { error: updateError } =
      await supabaseAdmin
        .from("registration_orders")
        .update({
          status: "paid",
          paid_at: new Date().toISOString()
        })
        .eq("id", order.id);

    if (updateError) {
      console.error("Payment update error:", updateError);

      return NextResponse.json(
        {
          success: false,
          error: "Could not update payment status."
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      publicReference: order.public_reference
    });

  } catch (error) {
    console.error("Verify route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unexpected verification error."
      },
      { status: 500 }
    );
  }
}