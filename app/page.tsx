"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Instagram,
  Facebook,
  Youtube
} from "lucide-react";
import { FaTiktok } from "react-icons/fa";

export default function HomePage() {
  const [pendingPayment, setPendingPayment] = useState<{
    publicReference: string;
    savedAt: string;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const PENDING_PAYMENT_EXPIRY_MS = 24 * 60 * 60 * 1000;

  useEffect(() => {
    const saved = localStorage.getItem("pendingStarCampPayment");

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      const savedAt = new Date(parsed.savedAt).getTime();
      const expired =
        Number.isNaN(savedAt) ||
        Date.now() - savedAt > PENDING_PAYMENT_EXPIRY_MS;

      if (expired) {
        localStorage.removeItem("pendingStarCampPayment");
        return;
      }

      setPendingPayment(parsed);
    } catch {
      localStorage.removeItem("pendingStarCampPayment");
    }
  }, []);

  async function retryPayment() {
    if (!pendingPayment) return;

    try {
      setRetrying(true);

      const response = await fetch("/api/payments/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          publicReference: pendingPayment.publicReference
        })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error ?? "Could not restart payment.");
        return;
      }

      window.location.href = result.paymentUrl;
    } finally {
      setRetrying(false);
    }
  }

  function clearPendingPayment() {
    localStorage.removeItem("pendingStarCampPayment");
    setPendingPayment(null);
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 py-8 text-center">
        <Image src="/tkh-logo.png" alt="The King's Hub logo" width={170} height={170} priority />
        <p className="mt-5 text-sm uppercase tracking-[0.35em] text-gold">The King&apos;s Hub</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-royalDark md:text-7xl">
          TEST STAR Camp Registration
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
          Hello! Here, you can register for Global STAR Camp 2026 or Eastern Region STAR Camp 2026. Ensure you select the right camp, provide complete and accurate details, and pay. For inquiries or complaints, please contact us at hello@thekingshub.world. 
        </p>

        {pendingPayment && (
          <div className="mt-8 w-full max-w-2xl rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-left">
            <p className="font-semibold text-amber-900">
              You have an unfinished registration payment.
            </p>

            <p className="mt-2 text-sm text-amber-800">
              If this is your registration, you can try payment again. If someone else
              is using this device, you can start a new registration instead.
            </p>

            <p className="mt-2 text-xs text-amber-700">
              Reference: {pendingPayment.publicReference}
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={retryPayment}
                disabled={retrying}
                className="rounded-full bg-royal px-5 py-3 text-sm font-semibold text-white disabled:bg-gray-300 disabled:text-gray-500"
              >
                {retrying ? "Preparing payment..." : "Try payment again"}
              </button>

              <Link
                href="/register"
                onClick={clearPendingPayment}
                className="rounded-full border border-amber-300 px-5 py-3 text-center text-sm font-semibold text-amber-900"
              >
                Start new registration instead
              </Link>

              <button
                type="button"
                onClick={clearPendingPayment}
                className="rounded-full px-5 py-3 text-sm font-semibold text-amber-900"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <Link
          href="/register"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-royal px-7 py-4 text-sm font-semibold text-white shadow-soft transition hover:bg-royalDark"
        >
          Start registration <ArrowRight size={18} />
        </Link>
      </section>
      <div className="mt-16 flex justify-center">
        <div className=" flex items-center gap-6 text-muted">
          <a
            href="https://www.instagram.com/thekingshubfamily/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-royal"
          >
            <Instagram size={24} />
          </a>

          <a
            href="https://www.facebook.com/TeensConnectWorld/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-royal"
          >
            <Facebook size={24} />
          </a>

          <a
            href="https://www.tiktok.com/@thekingshubfamilyglobal"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-royal"
          >
            <FaTiktok size={22} />
          </a>

          <a
            href="https://www.youtube.com/@TheKingshubfamily"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-royal"
          >
            <Youtube size={24} />
          </a>
        </div>
      </div>
    </main>
    
  );
}
