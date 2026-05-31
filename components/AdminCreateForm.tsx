"use client";

import { useState } from "react";

const EVENTS = [
  { slug: "abuja-2026", label: "STAR Camp Abuja 2026" },
  { slug: "owerri-2026", label: "STAR Camp Owerri 2026" }
];

export function AdminCreateForm() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"scanner" | "manager">("scanner");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [eventSlugs, setEventSlugs] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleEvent(slug: string) {
    setEventSlugs((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug]
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setStatus(null);

      const response = await fetch("/api/admin/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          fullName,
          role,
          isSuperAdmin,
          eventSlugs
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus(result.error ?? "Could not save admin.");
        return;
      }

      setStatus("Admin saved successfully.");
      setEmail("");
      setFullName("");
      setRole("scanner");
      setIsSuperAdmin(false);
      setEventSlugs([]);

      window.location.reload();
    } catch {
      setStatus("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-10 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft"
    >
      <h2 className="text-2xl font-semibold text-royalDark">
        Add or update admin
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <input
          type="email"
          required
          placeholder="Admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl border border-purple-100 px-4 py-3"
        />

        <input
          type="text"
          required
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-2xl border border-purple-100 px-4 py-3"
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "scanner" | "manager")}
          disabled={isSuperAdmin}
          className="rounded-2xl border border-purple-100 px-4 py-3"
        >
          <option value="scanner">Scanner</option>
          <option value="manager">Manager</option>
        </select>

        <label className="flex items-center gap-3 rounded-2xl border border-purple-100 px-4 py-3">
          <input
            type="checkbox"
            checked={isSuperAdmin}
            onChange={(e) => setIsSuperAdmin(e.target.checked)}
          />
          Super admin
        </label>
      </div>

      {!isSuperAdmin && (
        <div className="mt-6">
          <p className="font-semibold text-royalDark">Event access</p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {EVENTS.map((event) => (
              <label
                key={event.slug}
                className="flex items-center gap-3 rounded-2xl border border-purple-100 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={eventSlugs.includes(event.slug)}
                  onChange={() => toggleEvent(event.slug)}
                />
                {event.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save admin"}
      </button>

      {status && (
        <p className="mt-4 rounded-2xl bg-lavender p-4 text-sm text-royalDark">
          {status}
        </p>
      )}
    </form>
  );
}