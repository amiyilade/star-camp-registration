"use client";

import { useState } from "react";

const EVENTS = [
  { slug: "abuja-2026", label: "STAR Camp Abuja 2026" },
  { slug: "owerri-2026", label: "STAR Camp Owerri 2026" }
];

export function AdminEditCard({ admin }: { admin: any }) {
  const [fullName, setFullName] = useState(admin.full_name ?? "");
  const [isSuperAdmin, setIsSuperAdmin] = useState(admin.is_super_admin);
  const [eventSlugs, setEventSlugs] = useState<string[]>(
    admin.admin_event_roles
      ?.filter((item: any) => item.is_active)
      .map((item: any) => item.events?.slug)
      .filter(Boolean) ?? []
  );
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleEvent(slug: string) {
    setEventSlugs((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug]
    );
  }

  async function saveAdmin() {
    try {
      setLoading(true);
      setStatus(null);

      const response = await fetch("/api/admin/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: admin.email,
          fullName,
          isSuperAdmin,
          role:"scanner",
          eventSlugs
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus(result.error ?? "Could not update admin.");
        return;
      }

      setStatus("Saved.");
      window.location.reload();
    } catch {
      setStatus("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-muted">Email</p>
          <p className="mt-1 font-semibold text-royalDark">{admin.email}</p>
        </div>

        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-2xl border border-purple-100 px-4 py-3"
          placeholder="Full name"
        />

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
        <div className="mt-5">
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
        type="button"
        onClick={saveAdmin}
        disabled={loading}
        className="mt-5 rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save changes"}
      </button>

      {status && (
        <p className="mt-4 rounded-2xl bg-lavender p-4 text-sm text-royalDark">
          {status}
        </p>
      )}
    </div>
  );
}