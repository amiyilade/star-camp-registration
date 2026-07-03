import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const reference = request.nextUrl.searchParams.get("reference");

    if (!reference) {
      return NextResponse.json(
        {
          success: false,
          status: "error",
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
          status: "error",
          error: "Missing Paystack secret key."
        },
        { status: 500 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("registration_orders")
      .select(
        "id, public_reference, status, paystack_authorization_url"
      )
      .eq("paystack_reference", reference)
      .single();

    if (orderError || !order) {
      console.error("Order lookup error:", orderError);

      return NextResponse.json(
        {
          success: false,
          status: "error",
          error: "Registration order not found."
        },
        { status: 404 }
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

    if (!paystackResponse.ok || !paystackData.status) {
      console.error("Paystack verify error:", paystackData);

      return NextResponse.json(
        {
          success: false,
          status: "error",
          error: "Could not verify payment.",
          publicReference: order.public_reference
        },
        { status: 400 }
      );
    }

    const transaction = paystackData.data;
    const transactionStatus = transaction.status;

    if (transactionStatus !== "success") {
      const status =
        transactionStatus === "failed"
          ? "failed"
          : transactionStatus === "abandoned"
            ? "abandoned"
            : "pending";

      return NextResponse.json(
        {
          success: false,
          status,
          error:
            status === "failed"
              ? "Your payment was declined or failed. Your registration was saved, but payment was not completed."
              : status === "abandoned"
                ? "You left the payment page before completing payment. Your registration was saved, but payment was not completed."
                : "Your payment has not been confirmed yet. If you completed payment, please wait a few minutes and check again.",
          publicReference: order.public_reference
        },
        { status: 200 }
      );
    }

    if (order.status === "paid") {
      return NextResponse.json({
        success: true,
        status: "success",
        publicReference: order.public_reference
      });
    }

    const { error: updateError } = await supabaseAdmin
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
          status: "error",
          error: "Could not update payment status.",
          publicReference: order.public_reference
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: "success",
      publicReference: order.public_reference
    });
  } catch (error) {
    console.error("Verify route error:", error);

    return NextResponse.json(
      {
        success: false,
        status: "error",
        error: "Unexpected verification error."
      },
      { status: 500 }
    );
  }
}