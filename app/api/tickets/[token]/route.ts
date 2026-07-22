import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const { data: ticket, error } = await supabaseAdmin
      .from("tickets")
      .select(`
        ticket_code,
        status,
        checked_in_at,
        checked_out_at,
        registration_orders!inner (
          status
        ),
        attendees (
          first_name,
          last_name,
          email,
          department
        ),
        events (
          name,
          location,
          date_start,
          date_end
        )
      `)
      .eq("qr_token", token)
      .single();

    if (error || !ticket) {
      return NextResponse.json(
        { error: "Ticket not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Ticket lookup error:", error);

    return NextResponse.json(
      { error: "Could not load ticket." },
      { status: 500 }
    );
  }
}