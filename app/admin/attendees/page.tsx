"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";

export default function AdminAttendeesPage() {
  const [search, setSearch] = useState("");
  const [eventSlug, setEventSlug] = useState("all");
  const [events, setEvents] = useState<any[]>([]);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingTicketId, setSendingTicketId] = useState<string | null>(null);
  const [sentTicketId, setSentTicketId] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  async function runSearch() {
    if (search.trim().length < 2) {
      setAttendees([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/attendees?search=${encodeURIComponent(
          search
        )}&eventSlug=${encodeURIComponent(eventSlug)}`
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/admin/login";
          return;
        }

        setError(result.error ?? "Could not search attendees.");
        return;
      }

      setAttendees(result.attendees ?? []);
      setEvents(result.events ?? []);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function resendTicket(ticketId: string) {
    try {
      setSendingTicketId(ticketId);
      setSentTicketId(null);

      const response = await fetch("/api/admin/tickets/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ticketId })
      });

      const result = await response.json();

      if (!response.ok) {
        setResendError(result.error ?? "Could not resend ticket.");
        return;
      }

      setSentTicketId(ticketId);

      setTimeout(() => {
        setSentTicketId(null);
      }, 3000);
    } finally {
      setSendingTicketId(null);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      runSearch();
    }, 400);

    return () => clearTimeout(timeout);
  }, [search, eventSlug]);

  return (
    <AdminShell>
      <div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
            STAR Camp Admin
          </p>

          <h1 className="mt-2 text-4xl font-semibold text-royalDark">
            Attendee Lookup
          </h1>

          <p className="mt-2 text-muted">
            Search attendees by name, email, phone, guardian phone, or ticket
            code.
          </p>
        </div>
        {resendError && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {resendError}
        </div>
      )}

        <section className="mt-8 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
          <div className="grid gap-4 md:grid-cols-[1fr_240px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone, guardian phone, ticket code..."
              className="rounded-2xl border border-purple-100 px-4 py-3 outline-none focus:border-royal"
            />

            <select
              value={eventSlug}
              onChange={(event) => setEventSlug(event.target.value)}
              className="rounded-2xl border border-purple-100 px-4 py-3"
            >
              <option value="all">All accessible events</option>

              {events.map((event) => (
                <option key={event.slug} value={event.slug}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          {loading && (
            <p className="mt-4 text-sm text-muted">Searching...</p>
          )}

          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
        </section>

        <section className="mt-8 space-y-4">
          {attendees.map((attendee) => {
            const event = Array.isArray(attendee.events)
              ? attendee.events[0]
              : attendee.events;

            const ticket = Array.isArray(attendee.tickets)
              ? attendee.tickets[0]
              : attendee.tickets;

            const team = Array.isArray(ticket?.teams)
              ? ticket.teams[0]
              : ticket?.teams;

            const isCurrentlyCheckedIn =
              ticket?.checked_in_at &&
              (!ticket?.checked_out_at ||
                new Date(ticket.checked_in_at) >
                  new Date(ticket.checked_out_at));

            return (
              <div
                key={attendee.id}
                className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-royal">
                      {event?.name}
                    </p>

                    <h2 className="mt-2 text-3xl font-black text-royalDark">
                      {attendee.first_name} {attendee.last_name}
                    </h2>

                    <p className="mt-2 text-muted">
                      {attendee.email || "No attendee email"} ·{" "}
                      {attendee.phone_country_code}
                      {attendee.phone_number}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-lavender px-5 py-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Team
                    </p>

                    <p className="mt-1 text-xl font-black text-royal">
                      {team?.name ?? "Not assigned"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <Info
                    label="Age Group"
                    value={
                      attendee.age_at_registration < 20
                        ? "Under 20"
                        : "20 or older"
                    }
                  />
                  <Info label="Department" value={attendee.department} />
                  <Info
                    label="Ticket"
                    value={ticket?.ticket_code ?? "No ticket"}
                  />
                  <Info
                    label="Check-in"
                    value={
                      isCurrentlyCheckedIn
                        ? "Currently checked in"
                        : ticket?.checked_out_at
                          ? "Checked out"
                          : "Not checked in"
                    }
                  />
                  <Info
                    label="Badge"
                    value={ticket?.badge_status ?? "No badge status"}
                  />
                  <Info
                    label="Ticket Email"
                    value={ticket ? "Generated" : "No ticket"}
                  />
                </div>

                <div className="mt-6 rounded-2xl bg-lavender p-4">
                  <p className="text-sm font-semibold text-royalDark">
                    Contact / Guardian
                  </p>

                  <p className="mt-2 text-sm text-muted">
                    Guardian: {attendee.guardian_name || "—"}{" "}
                    {attendee.guardian_phone_number
                      ? `· ${attendee.guardian_phone_country_code}${attendee.guardian_phone_number}`
                      : ""}
                  </p>

                  <p className="mt-1 text-sm text-muted">
                    Emergency: {attendee.emergency_contact_name || "—"}{" "}
                    {attendee.emergency_contact_phone_number
                      ? `· ${attendee.emergency_contact_phone_country_code}${attendee.emergency_contact_phone_number}`
                      : ""}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {ticket?.qr_token && (
                    <Link
                      href={`/tickets/${ticket.qr_token}`}
                      target="_blank"
                      className="rounded-full border border-purple-200 px-5 py-3 text-sm font-semibold text-royal hover:bg-lavender"
                    >
                      Open Ticket
                    </Link>
                  )}

                  {ticket?.id && (
                    <button
                      type="button"
                      disabled={
                        sendingTicketId === ticket.id ||
                        sentTicketId === ticket.id
                      }
                      onClick={() => resendTicket(ticket.id)}
                      className="rounded-full bg-royal px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {sendingTicketId === ticket.id
                        ? "Sending..."
                        : sentTicketId === ticket.id
                          ? "✓ Sent"
                          : "Resend Ticket"}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled
                    className="rounded-full border border-purple-200 px-5 py-3 text-sm font-semibold text-muted opacity-60"
                  >
                    View History Coming Soon
                  </button>
                </div>
              </div>
            );
          })}

          {!loading && search.trim().length >= 2 && attendees.length === 0 && (
            <div className="rounded-[2rem] border border-purple-100 bg-white p-8 text-center shadow-soft">
              <p className="text-muted">No matching attendees found.</p>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function Info({
  label,
  value
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-purple-100 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </p>
      <p className="mt-2 font-semibold text-royalDark">{value || "—"}</p>
    </div>
  );
}