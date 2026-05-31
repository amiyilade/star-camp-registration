"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (user?.email) {
        window.location.href = "/admin/scan";
      }
    }

    checkSession();
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setStatus(null);

      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/scan`
        }
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Check your email for the login link.");
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
          Enter your approved admin email to access the scanner.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label className="text-sm font-semibold text-royalDark">
              Email address
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3 outline-none focus:border-royal"
              placeholder="admin@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white shadow-soft hover:bg-royalDark disabled:opacity-60"
          >
            {loading ? "Sending login link..." : "Send login link"}
          </button>
        </form>

        {status && (
          <p className="mt-5 rounded-2xl bg-lavender p-4 text-sm text-royalDark">
            {status}
          </p>
        )}
      </div>
    </main>
  );
}