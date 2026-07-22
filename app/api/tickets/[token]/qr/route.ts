import QRCode from "qrcode";
import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  try {
    const { token } = await context.params;

    const { data: ticket, error } = await supabaseAdmin
      .from("tickets")
      .select(`
        status,
        registration_orders!inner (
          status
        )
      `)
      .eq("qr_token", token)
      .single();

    if (error || !ticket) {
      return new Response("Ticket not found.", {
        status: 404
      });
    }

    const order = Array.isArray(ticket.registration_orders)
      ? ticket.registration_orders[0]
      : ticket.registration_orders;

    const isValidTicket =
      order?.status === "paid" && ticket.status === "valid";

    if (!isValidTicket) {
      return new Response("Ticket is not valid.", {
        status: 403,
        headers: {
          "Cache-Control": "no-store"
        }
      });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const ticketUrl = `${appUrl}/tickets/${token}`;

    const pngBuffer = await QRCode.toBuffer(ticketUrl, {
      width: 400,
      margin: 2
    });

    return new Response(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (error) {
    console.error("Ticket QR generation error:", error);

    return new Response("Could not generate ticket QR code.", {
      status: 500,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }
}