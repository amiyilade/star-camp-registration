type InitializePaystackInput = {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export async function initializePaystackTransaction({
  email,
  amountKobo,
  reference,
  callbackUrl,
  metadata
}: InitializePaystackInput) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing PAYSTACK_SECRET_KEY");
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      currency: "NGN",
      reference,
      callback_url: callbackUrl,
      metadata
    })
  });

  const result = await response.json();

  if (!response.ok || !result.status) {
    console.error("Paystack initialize error:", result);
    throw new Error(result.message ?? "Could not initialize Paystack transaction.");
  }

  return result.data as {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}