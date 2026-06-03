"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";

const EVENTS = [
  { slug: "abuja-2026", label: "STAR Camp Abuja" },
  { slug: "owerri-2026", label: "STAR Camp Owerri" }
];

export default function AdminDashboardPage() {
  const [eventSlug, setEventSlug] = useState("abuja-2026");
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/dashboard?eventSlug=${eventSlug}`
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Could not load dashboard.");
        return;
      }

      setData(result);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(loadDashboard, 10000);

    return () => clearInterval(interval);
  }, [eventSlug]);

  const metrics = data?.metrics;

  return (
    <AdminShell>
      <div>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
              STAR Camp Admin
            </p>

            <h1 className="mt-2 text-4xl font-semibold text-royalDark">
              Dashboard
            </h1>

            <p className="mt-2 text-muted">
              Live registration, check-in, badge, and team overview.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
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

            <Link
              href="/admin/manage"
              className="rounded-full bg-royal px-6 py-3 text-center text-sm font-semibold text-white"
            >
              Manage Admins
            </Link>
          </div>
        </div>

        {loading && <p className="mt-8 text-muted">Loading dashboard...</p>}

        {error && (
          <p className="mt-8 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">
            {error}
          </p>
        )}

        {metrics && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-4">
              <MetricCard
                label="Ticket Sales"
                value={metrics.formattedTotalRevenue}
              />
              <MetricCard
                label="Refunded"
                value={metrics.formattedRefundedRevenue}
              />
              <MetricCard
                label="Paid Attendees"
                value={metrics.totalPaidAttendees}
              />
              <MetricCard
                label="Currently Checked In"
                value={metrics.currentlyCheckedIn}
              />
              <MetricCard
                label="Checked Out"
                value={metrics.checkedOut}
              />
              <MetricCard
                label="Badges Pending"
                value={metrics.badgeCounts.pending}
              />
              <MetricCard
                label="Badges Printed"
                value={metrics.badgeCounts.printed}
              />
              <MetricCard
                label="Badges Issued"
                value={metrics.badgeCounts.issued}
              />
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <Panel title="Team Counts">
                <div className="space-y-3">
                  {Object.entries(metrics.teamCounts).map(([team, count]) => (
                    <div
                      key={team}
                      className="flex items-center justify-between rounded-2xl bg-lavender px-4 py-3"
                    >
                      <span className="font-semibold text-royalDark">
                        {team}
                      </span>
                      <span className="text-xl font-bold text-royal">
                        {String(count)}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Registration Trends">
                <div className="space-y-3">
                  {Object.entries(metrics.registrationTrends).map(
                    ([date, trend]: any) => (
                      <div
                        key={date}
                        className="rounded-2xl border border-purple-100 p-4"
                      >
                        <p className="font-semibold text-royalDark">{date}</p>
                        <p className="mt-1 text-sm text-muted">
                          {trend.tickets} tickets · ₦
                          {Number(trend.revenue).toLocaleString("en-NG")}
                        </p>
                      </div>
                    )
                  )}

                  {Object.keys(metrics.registrationTrends).length === 0 && (
                    <p className="text-muted">No paid registrations yet.</p>
                  )}
                </div>
              </Panel>
            </section>

            <section className="mt-8">
              <Panel title="Recent Check-In Activity">
                <div className="space-y-3">
                  {metrics.recentLogs.map((log: any, index: number) => {
                    const attendee = Array.isArray(log.attendees)
                      ? log.attendees[0]
                      : log.attendees;

                    return (
                      <div
                        key={index}
                        className="rounded-2xl border border-purple-100 p-4"
                      >
                        <p className="font-semibold text-royalDark">
                          {attendee?.first_name} {attendee?.last_name}
                        </p>

                        <p className="mt-1 text-sm text-muted">
                          {log.action} · {log.admin_email} ·{" "}
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}

                  {metrics.recentLogs.length === 0 && (
                    <p className="text-muted">No check-in activity yet.</p>
                  )}
                </div>
              </Panel>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function MetricCard({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-royalDark">
        {value}
      </p>
    </div>
  );
}

function Panel({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
      <h2 className="text-2xl font-semibold text-royalDark">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}