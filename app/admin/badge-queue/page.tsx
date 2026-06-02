"use client";

import { useEffect, useState } from "react";

const EVENTS = [
  { slug: "abuja-2026", label: "STAR Camp Abuja" },
  { slug: "owerri-2026", label: "STAR Camp Owerri" }
];

export default function BadgeQueuePage() {
  const [eventSlug, setEventSlug] = useState("abuja-2026");
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadQueue() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/badge-queue?eventSlug=${eventSlug}`
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Could not load badge queue.");
        return;
      }

      setTickets(result.tickets ?? []);
    } catch {
      setError("Something went wrong loading badge queue.");
    } finally {
      setLoading(false);
    }
  }

  async function updateBadge(ticketId: string, action: "mark_printed" | "mark_issued") {
    const response = await fetch("/api/admin/badge-queue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ticketId,
        action
      })
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error ?? "Could not update badge.");
      return;
    }

    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === ticketId ? result.ticket : ticket
      )
    );
  }

  useEffect(() => {
    loadQueue();

    const interval = setInterval(loadQueue, 5000);

    return () => clearInterval(interval);
  }, [eventSlug]);

  return (
    <main className="min-h-screen bg-lavender px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
              STAR Camp Admin
            </p>

            <h1 className="mt-2 text-4xl font-semibold text-royalDark">
              Badge Queue
            </h1>

            <p className="mt-2 text-muted">
              Recent check-ins for badge writing or future label printing.
            </p>
          </div>

          <select
            value={eventSlug}
            onChange={(event) => setEventSlug(event.target.value)}
            className="rounded-2xl border border-purple-100 bg-white px-4 py-3"
          >
            {EVENTS.map((event) => (
              <option key={event.slug} value={event.slug}>
                {event.label}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <p className="mt-8 text-muted">Loading queue...</p>
        )}

        {error && (
          <p className="mt-8 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-4">
          {tickets.map((ticket) => {
            const attendee = Array.isArray(ticket.attendees)
              ? ticket.attendees[0]
              : ticket.attendees;

            const team = Array.isArray(ticket.teams)
              ? ticket.teams[0]
              : ticket.teams;

            return (
              <div
                key={ticket.id}
                className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-royal">
                      {ticket.badge_status}
                    </p>

                    <h2 className="mt-2 text-3xl font-black text-royalDark">
                      {attendee?.first_name} {attendee?.last_name}
                    </h2>

                    <p className="mt-2 text-lg font-semibold text-royal">
                      {team?.name ?? "No team assigned"}
                    </p>

                    <p className="mt-2 text-sm text-muted">
                      {attendee?.department ?? "No department"} ·{" "}
                      {attendee?.age_at_registration < 20
                        ? "Under 20"
                        : "20 or older"}
                    </p>

                    <p className="mt-1 text-xs text-muted">
                      Checked in: {ticket.checked_in_at}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {ticket.badge_status === "pending" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateBadge(ticket.id, "mark_printed")
                        }
                        className="rounded-full border border-purple-200 px-5 py-3 text-sm font-semibold text-royal"
                      >
                        Mark printed
                      </button>
                    )}

                    {ticket.badge_status !== "issued" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateBadge(ticket.id, "mark_issued")
                        }
                        className="rounded-full bg-royal px-5 py-3 text-sm font-semibold text-white"
                      >
                        Mark issued
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && tickets.length === 0 && (
            <div className="rounded-[2rem] border border-purple-100 bg-white p-8 text-center shadow-soft">
              <p className="text-muted">
                No checked-in attendees yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}