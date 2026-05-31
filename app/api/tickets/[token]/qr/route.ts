import QRCode from "qrcode";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  const { token } = await context.params;

  const ticketUrl =
    `${process.env.NEXT_PUBLIC_APP_URL}/tickets/${token}`;

  const pngBuffer = await QRCode.toBuffer(ticketUrl, {
    width: 400,
    margin: 2
  });

  return new Response(new Uint8Array(pngBuffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400"
    }
  });
}