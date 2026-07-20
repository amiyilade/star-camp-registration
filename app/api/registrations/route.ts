import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { registrationSchema } from "@/lib/registration-schema";
import { normaliseRegistrationForDatabase } from "@/lib/normalise-registration";
import { generatePublicReference } from "@/lib/generate-public-reference";
import { initializePaystackTransaction } from "@/lib/paystack";
import { generatePaystackReference } from "@/lib/generate-paystack-reference";

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function deleteRegistrationOrder(orderId: string) {
  const { error } = await supabaseAdmin
    .from("registration_orders")
    .delete()
    .eq("id", orderId);

  if (error) {
    console.error("Failed to clean up registration order:", {
      orderId,
      error
    });

    return false;
  }

  return true;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = registrationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid registration data.",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const duplicateOverrideIndexes =
      parsed.data.duplicateOverrideAttendeeIndexes ?? [];

    const normalised = normaliseRegistrationForDatabase(parsed.data);

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, price_ngn")
      .eq("slug", normalised.order.event_slug)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Selected event was not found." },
        { status: 404 }
      );
    }

    const unitPrice = event.price_ngn;
    const totalAmount = unitPrice * normalised.order.ticket_quantity;
    const publicReference = generatePublicReference(
      normalised.order.event_slug
    );

    const duplicateIndexes: number[] = [];

    for (
      let index = 0;
      index < parsed.data.attendees.length;
      index++
    ) {
      const attendee = parsed.data.attendees[index];

      const { data: matches, error } = await supabaseAdmin
        .from("attendees")
        .select(`
          id,
          registration_orders!inner(status)
        `)
        .eq("event_id", event.id)
        .ilike("first_name", normalizeName(attendee.firstName))
        .ilike("last_name", normalizeName(attendee.lastName))
        .eq("date_of_birth", attendee.dateOfBirth)
        .in("registration_orders.status", ["pending_payment", "paid"])
        .limit(1);

      if (error) {
        console.error("Duplicate check error:", error);

        return NextResponse.json(
          { error: "Could not check for duplicate registrations." },
          { status: 500 }
        );
      }

      if (matches && matches.length > 0) {
        duplicateIndexes.push(index);
      }
    }

    const unacknowledgedDuplicates = duplicateIndexes.filter(
      (index) => !duplicateOverrideIndexes.includes(index)
    );

    if (unacknowledgedDuplicates.length > 0) {
      return NextResponse.json(
        {
          error: "Possible duplicate attendee detected.",
          duplicateIndexes: unacknowledgedDuplicates
        },
        { status: 409 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("registration_orders")
      .insert({
        event_id: event.id,
        buyer_full_name: normalised.order.buyer_full_name,
        buyer_email: normalised.order.buyer_email,
        buyer_phone_country_code:
          normalised.order.buyer_phone_country_code,
        buyer_phone_number: normalised.order.buyer_phone_number,
        ticket_quantity: normalised.order.ticket_quantity,
        unit_price_ngn: unitPrice,
        total_amount_ngn: totalAmount,
        public_reference: publicReference,
        status: "draft",
        form_version: normalised.order.form_version
      })
      .select("id, public_reference")
      .single();

    if (orderError || !order) {
      console.error("Order insert error:", orderError);

      return NextResponse.json(
        { error: "Could not save registration order." },
        { status: 500 }
      );
    }

    const attendeesToInsert = normalised.attendees.map((attendee) => ({
      ...attendee,
      order_id: order.id,
      event_id: event.id
    }));

    const { error: attendeesError } = await supabaseAdmin
      .from("attendees")
      .insert(attendeesToInsert);

    if (attendeesError) {
      console.error("Attendee insert error:", attendeesError);

      await deleteRegistrationOrder(order.id);

      return NextResponse.json(
        { error: "Could not save attendee details." },
        { status: 500 }
      );
    }

    const paystackReference = generatePaystackReference(
      order.public_reference
    );

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    let paystack: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };

    try {
      paystack = await initializePaystackTransaction({
        email: normalised.order.buyer_email,
        amountKobo: totalAmount * 100,
        reference: paystackReference,
        callbackUrl: `${appUrl}/payment/callback`,
        metadata: {
          order_id: order.id,
          public_reference: order.public_reference,
          event_slug: normalised.order.event_slug,
          ticket_quantity: normalised.order.ticket_quantity
        }
      });
    } catch (error) {
      console.error("Paystack initialization failed:", {
        orderId: order.id,
        error
      });

      const cleanedUp = await deleteRegistrationOrder(order.id);

      return NextResponse.json(
        {
          error: cleanedUp
            ? "Payment could not be initialized. No registration was created. Please try again."
            : "Payment could not be initialized. Please contact support before trying again."
        },
        { status: 502 }
      );
    }

    const { error: paymentUpdateError } = await supabaseAdmin
      .from("registration_orders")
      .update({
        status: "pending_payment",
        paystack_reference: paystackReference,
        paystack_authorization_url: paystack.authorization_url
      })
      .eq("id", order.id);

    if (paymentUpdateError) {
      console.error("Payment update error:", {
        orderId: order.id,
        paystackReference,
        error: paymentUpdateError
      });

      // Paystack created a transaction, but the application could not persist
      // the normal pending-payment state. Retain an auditable cancelled record
      // where possible.
      const { error: cancellationError } = await supabaseAdmin
        .from("registration_orders")
        .update({
          status: "cancelled",
          paystack_reference: paystackReference,
          paystack_authorization_url: paystack.authorization_url
        })
        .eq("id", order.id);

      if (cancellationError) {
        console.error("Failed to mark broken payment order as cancelled:", {
          orderId: order.id,
          paystackReference,
          error: cancellationError
        });

        const cleanedUp = await deleteRegistrationOrder(order.id);

        return NextResponse.json(
          {
            error: cleanedUp
              ? "Payment setup could not be completed. No registration was created. Please try again."
              : "Payment setup could not be completed. Please contact support before trying again."
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error:
            "Payment setup could not be completed. The registration was cancelled and no payment link was issued. Please try again."
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Registration saved. Redirecting to payment.",
        orderId: order.id,
        publicReference: order.public_reference,
        paymentUrl: paystack.authorization_url
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration API error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}