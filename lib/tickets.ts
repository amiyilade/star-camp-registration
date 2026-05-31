import crypto from "crypto";

function randomCode(length: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

export function generateTicketCode(eventSlug: string) {
  const prefix = eventSlug === "abuja-2026" ? "ABJ" : "OWR";

  return `SC-${prefix}-${randomCode(8)}`;
}

export function generateQrToken() {
  return crypto.randomBytes(32).toString("hex");
}