"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user?.email) return;

      const response = await fetch("/api/admin/me");

      if (response.ok) {
        window.location.href = "/admin/scan";
        return;
      }

      await supabase.auth.signOut();
    }

    checkSession();
  }, []);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setStatus(null);

      const response = await fetch("/api/admin/auth/request-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus(result.error ?? "Could not send login code.");
        return;
      }

      setCodeSent(true);
      setStatus("Login code sent. Check your email.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setStatus(null);

      const supabase = createClient();

      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: "email"
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      const response = await fetch("/api/admin/me");

      if (!response.ok) {
        await supabase.auth.signOut();
        setStatus("This email is not authorized for admin access.");
        return;
      }

      window.location.href = "/admin/scan";
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-lavender px-6 py-16">
      <div className="mx-auto max-w-md rounded-[2rem] border border-purple-100 bg-white p-8 shadow-soft">
        <h1 className="text-3xl font-semibold text-royalDark">
          Admin Login
        </h1>

        <p className="mt-2 text-muted">
          Enter your approved admin email to receive a login code.
        </p>

        {!codeSent ? (
          <form onSubmit={requestCode} className="mt-8 space-y-5">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-purple-100 px-4 py-3 outline-none focus:border-royal"
              placeholder="admin@example.com"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white shadow-soft hover:bg-royalDark disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send login code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-8 space-y-5">
            <input
              type="text"
              inputMode="numeric"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="w-full rounded-2xl border border-purple-100 px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:border-royal"
              placeholder="123456"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white shadow-soft hover:bg-royalDark disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify code"}
            </button>

            <button
              type="button"
              onClick={() => {
                setCodeSent(false);
                setCode("");
                setStatus(null);
              }}
              className="w-full text-sm font-semibold text-royal"
            >
              Use a different email
            </button>
          </form>
        )}

        {status && (
          <p className="mt-5 rounded-2xl bg-lavender p-4 text-sm text-royalDark">
            {status}
          </p>
        )}
      </div>
    </main>
  );
}