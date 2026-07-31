"use client";

import { useEffect, useState } from "react";

import { AdminShell } from "@/components/AdminShell";

function getSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatAction(action: string) {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const [eventSlug, setEventSlug] = useState("all");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLogs() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/logs?eventSlug=${encodeURIComponent(
          eventSlug
        )}&action=${encodeURIComponent(action)}&page=${page}`
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/admin/login";
          return;
        }

        if (response.status === 403) {
          window.location.href = "/admin/scan";
          return;
        }

        setError(result.error ?? "Could not load logs.");
        return;
      }

      setLogs(result.logs ?? []);
      setEvents(result.events ?? []);
    } catch {
      setError("Something went wrong while loading logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [eventSlug, action, page]);

  return (
    <AdminShell>
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
          STAR Camp Admin
        </p>

        <h1 className="mt-2 text-4xl font-semibold text-royalDark">
          Operational Logs
        </h1>

        <p className="mt-2 text-muted">
          Review scanner, badge, ticket-delivery, and admin-management activity.
        </p>

        <section className="mt-8 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
          <div className="grid gap-4 md:grid-cols-2">
            <select
              value={eventSlug}
              onChange={(event) => {
                setEventSlug(event.target.value);
                setPage(1);
              }}
              className="rounded-2xl border border-purple-100 px-4 py-3"
            >
              <option value="all">All events</option>

              {events.map((event) => (
                <option key={event.slug} value={event.slug}>
                  {event.name}
                </option>
              ))}
            </select>

            <select
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              className="rounded-2xl border border-purple-100 px-4 py-3"
            >
              <option value="all">All actions</option>
              <option value="verify">Verify</option>
              <option value="check_in">Check in</option>
              <option value="check_out">Check out</option>
              <option value="duplicate_attempt">
                Duplicate / invalid attempt
              </option>
              <option value="access_denied">Access denied</option>
              <option value="badge_marked_printed">
                Badge marked printed
              </option>
              <option value="badge_marked_issued">
                Badge marked issued
              </option>
              <option value="ticket_resent">Ticket resent</option>
              <option value="ticket_resend_failed">
                Ticket resend failed
              </option>
              <option value="admin_created">Admin created</option>
              <option value="admin_updated">Admin updated</option>
            </select>
          </div>
        </section>

        {loading && (
          <p className="mt-6 text-sm text-muted">Loading logs...</p>
        )}

        {error && (
          <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <section className="mt-6 space-y-3">
          {logs.map((log) => {
            const attendee = getSingle<any>(log.attendees);
            const ticket = getSingle<any>(log.tickets);
            const event = getSingle<any>(log.events);

            return (
              <article
                key={`${log.source}-${log.id}`}
                className="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-soft"
              >
                <div className="flex flex-col justify-between gap-3 md:flex-row">
                  <div>
                    <p className="text-sm font-semibold text-royal">
                      {formatAction(log.action)}
                    </p>

                    <p className="mt-1 text-lg font-semibold text-royalDark">
                      {attendee
                        ? `${attendee.first_name} ${attendee.last_name}`
                        : "No attendee"}
                    </p>
                  </div>

                  <div className="text-sm text-muted md:text-right">
                    <p>{new Date(log.created_at).toLocaleString()}</p>
                    <p className="mt-1">{event?.name ?? "No event"}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <LogField
                    label="Admin"
                    value={log.admin_email}
                  />

                  <LogField
                    label="Ticket"
                    value={ticket?.ticket_code ?? "—"}
                  />

                  <LogField
                    label="Outcome"
                    value={log.outcome}
                  />
                </div>

                {log.notes && (
                  <p className="mt-4 rounded-2xl bg-lavender p-4 text-sm text-muted">
                    {log.notes}
                  </p>
                )}
              </article>
            );
          })}

          {!loading && logs.length === 0 && (
            <div className="rounded-[2rem] border border-purple-100 bg-white p-8 text-center shadow-soft">
              <p className="text-muted">No logs found.</p>
            </div>
          )}
        </section>

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            disabled={page === 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-full border border-purple-200 px-5 py-3 text-sm font-semibold text-royal disabled:opacity-50"
          >
            Previous
          </button>

          <p className="self-center text-sm text-muted">
            Page {page}
          </p>

          <button
            type="button"
            disabled={logs.length < 50 || loading}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-full border border-purple-200 px-5 py-3 text-sm font-semibold text-royal disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

function LogField({
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

      <p className="mt-2 font-semibold text-royalDark">
        {value || "—"}
      </p>
    </div>
  );
}