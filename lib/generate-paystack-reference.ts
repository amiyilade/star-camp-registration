export function generatePaystackReference(publicReference: string) {
  const timestamp = Date.now();
  return `${publicReference}-${timestamp}`;
}