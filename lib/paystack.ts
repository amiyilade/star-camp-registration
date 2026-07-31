type InitializePaystackInput = {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export class PaystackInitializationError extends Error {
  details: unknown;

  constructor(message: string, details: unknown) {
    super(message);
    this.name = "PaystackInitializationError";
    this.details = details;
  }
}

export async function initializePaystackTransaction({
  email,
  amountKobo,
  reference,
  callbackUrl,
  metadata
}: InitializePaystackInput) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new PaystackInitializationError(
      "Missing PAYSTACK_SECRET_KEY",
      null
    );
  }

  let response: Response;

  try {
    response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
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
      }
    );
  } catch (error) {
    throw new PaystackInitializationError(
      "Could not reach Paystack.",
      {
        cause:
          error instanceof Error
            ? error.message
            : "Unknown network error"
      }
    );
  }

  let result: unknown;

  try {
    result = await response.json();
  } catch {
    throw new PaystackInitializationError(
      "Paystack returned an unreadable response.",
      {
        httpStatus: response.status
      }
    );
  }

  const paystackResult = result as {
    status?: boolean;
    message?: string;
    data?: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  };

  if (!response.ok || !paystackResult.status || !paystackResult.data) {
    console.error("Paystack initialize error:", {
      httpStatus: response.status,
      result: paystackResult
    });

    throw new PaystackInitializationError(
      paystackResult.message ??
        "Could not initialize Paystack transaction.",
      {
        httpStatus: response.status,
        response: paystackResult
      }
    );
  }

  return paystackResult.data;
}