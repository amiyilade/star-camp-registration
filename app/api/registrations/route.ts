import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { registrationSchema } from "@/lib/registration-schema";
import { normaliseRegistrationForDatabase } from "@/lib/normalise-registration";
import { generatePublicReference } from "@/lib/generate-public-reference";
import { initializePaystackTransaction } from "@/lib/paystack";
import { generatePaystackReference } from "@/lib/generate-paystack-reference";

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

    const duplicateOverrideIndexes = parsed.data.duplicateOverrideAttendeeIndexes ?? [];

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
    const publicReference = generatePublicReference(normalised.order.event_slug);

    function normalizeName(value: string) {
      return value.trim().toLowerCase().replace(/\s+/g, " ");
    }

    const duplicateIndexes: number[] = [];

    for (let index = 0; index < parsed.data.attendees.length; index++) {
      const attendee = parsed.data.attendees[index];

      const { data: matches, error } = await supabaseAdmin
        .from("attendees")
        .select("id")
        .eq("event_id", event.id)
        .ilike("first_name", normalizeName(attendee.firstName))
        .ilike("last_name", normalizeName(attendee.lastName))
        .eq("date_of_birth", attendee.dateOfBirth)
        .limit(1);

      if (error) {
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
        buyer_phone_country_code: normalised.order.buyer_phone_country_code,
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

      await supabaseAdmin
        .from("registration_orders")
        .delete()
        .eq("id", order.id);

      return NextResponse.json(
        { error: "Could not save attendee details." },
        { status: 500 }
      );
    }


    const paystackReference = generatePaystackReference(order.public_reference);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const paystack = await initializePaystackTransaction({
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

    const { error: paymentUpdateError } = await supabaseAdmin
    .from("registration_orders")
    .update({
        status: "pending_payment",
        paystack_reference: paystackReference,
        paystack_authorization_url: paystack.authorization_url
    })
    .eq("id", order.id);

    if (paymentUpdateError) {
    console.error("Payment update error:", paymentUpdateError);

    return NextResponse.json(
        { error: "Registration was saved, but payment could not be initialized." },
        { status: 500 }
    );
    }

    return NextResponse.json(
    {
        message: "Registration draft saved. Redirecting to payment.",
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