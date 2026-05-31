function randomString(length: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

export function generatePublicReference(eventSlug: string) {
  const prefix =
    eventSlug === "abuja-2026"
      ? "SC-ABJ"
      : "SC-OWR";

  return `${prefix}-${randomString(6)}`;
}