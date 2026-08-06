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

export async function GET(
  request: NextRequest
) {
  try {
    const reference =
      request.nextUrl.searchParams.get(
        "reference"
      );

    if (!reference) {
      return NextResponse.json(
        {
          success: false,
          status: "error",
          error:
            "Missing payment reference."
        },
        { status: 400 }
      );
    }

    const secretKey =
      process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        {
          success: false,
          status: "error",
          error:
            "Missing Paystack secret key."
        },
        { status: 500 }
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
        "Order lookup error:",
        orderError
      );

      return NextResponse.json(
        {
          success: false,
          status: "error",
          error:
            "Registration order not found."
        },
        { status: 404 }
      );
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(
        reference
      )}`,
      {
        headers: {
          Authorization:
            `Bearer ${secretKey}`
        },
        cache: "no-store"
      }
    );

    let paystackData: any;

    try {
      paystackData =
        await paystackResponse.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          status: "error",
          error:
            "Paystack returned an unreadable verification response.",
          publicReference:
            order.public_reference
        },
        { status: 502 }
      );
    }

    if (
      !paystackResponse.ok ||
      !paystackData.status
    ) {
      console.error(
        "Paystack verify error:",
        paystackData
      );

      return NextResponse.json(
        {
          success: false,
          status: "error",
          error:
            "Could not verify payment.",
          publicReference:
            order.public_reference
        },
        { status: 400 }
      );
    }

    const transaction =
      paystackData.data;

    const transactionStatus =
      transaction?.status;

    if (
      transactionStatus !== "success"
    ) {
      const status =
        transactionStatus === "failed"
          ? "failed"
          : transactionStatus ===
              "abandoned"
            ? "abandoned"
            : "pending";

      return NextResponse.json({
        success: false,
        status,
        error:
          status === "failed"
            ? "Your payment was declined or failed. Your registration was saved, but payment was not completed."
            : status === "abandoned"
              ? "You left the payment page before completing payment. Your registration was saved, but payment was not completed."
              : "Your payment has not been confirmed yet. If you completed payment, please wait a few minutes and check again.",
        publicReference:
          order.public_reference
      });
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
        "Payment verification validation failed:",
        {
          reference,
          error
        }
      );

      return NextResponse.json(
        {
          success: false,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Payment validation failed.",
          publicReference:
            order.public_reference
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
          "Payment update error:",
          updateError
        );

        return NextResponse.json(
          {
            success: false,
            status: "error",
            error:
              "Could not update payment status.",
            publicReference:
              order.public_reference
          },
          { status: 500 }
        );
      }
    }

    const fulfillment =
      await fulfillPaidOrder(order.id);

    return NextResponse.json({
      success: true,
      status: "success",
      publicReference:
        order.public_reference,
      fulfillment
    });
  } catch (error) {
    console.error(
      "Verify route error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        status: "error",
        error:
          "Unexpected verification error."
      },
      { status: 500 }
    );
  }
}