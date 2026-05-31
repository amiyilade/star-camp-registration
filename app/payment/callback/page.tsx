"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type VerifyResponse =
  | {
      success: true;
      publicReference: string;
    }
  | {
      success: false;
      error: string;
    };

export default function PaymentCallbackPage() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyResponse | null>(null);

  useEffect(() => {
    async function verifyPayment() {
      try {
        const params = new URLSearchParams(window.location.search);

        const reference = params.get("reference");

        if (!reference) {
          setResult({
            success: false,
            error: "Missing payment reference."
          });

          return;
        }

        const response = await fetch(
          `/api/payments/verify?reference=${reference}`
        );

        const data = await response.json();

        setResult(data);
      } catch (error) {
        console.error(error);

        setResult({
          success: false,
          error: "Could not verify payment."
        });
      } finally {
        setLoading(false);
      }
    }

    verifyPayment();
  }, []);

  return (
    <main className="min-h-screen bg-white px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-purple-100 bg-white p-10 text-center shadow-soft">

        {loading && (
          <>
            <Loader2
              className="mx-auto animate-spin text-royal"
              size={48}
            />

            <h1 className="mt-6 text-3xl font-semibold text-royalDark">
              Verifying payment
            </h1>

            <p className="mt-3 text-muted">
              Please wait while we confirm your payment.
            </p>
          </>
        )}

        {!loading && result?.success && (
          <>
            <CheckCircle2
              className="mx-auto text-green-600"
              size={52}
            />

            <h1 className="mt-6 text-3xl font-semibold text-royalDark">
              Payment successful
            </h1>

            <p className="mt-3 text-muted">
              Your registration has been confirmed.
            </p>

            <p className="mt-6 text-sm font-semibold text-royal">
              Reference: {result.publicReference}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                    href="/register"
                    className="inline-flex items-center justify-center rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-royalDark"
                >
                    Register another person
                </a>

                <a
                    href="/"
                    className="inline-flex items-center justify-center rounded-full border border-purple-200 px-6 py-3 text-sm font-semibold text-royal transition hover:bg-lavender"
                >
                    Return to homepage
                </a>
            </div>
          </>
        )}

        {!loading && !result?.success && (
          <>
            <XCircle
              className="mx-auto text-red-600"
              size={52}
            />

            <h1 className="mt-6 text-3xl font-semibold text-royalDark">
              Payment verification failed
            </h1>

            <p className="mt-3 text-muted">
              {result?.error}
            </p>
          </>
        )}
      </div>
    </main>
  );
}