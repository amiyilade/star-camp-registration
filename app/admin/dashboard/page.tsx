"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { AdminShell } from "@/components/AdminShell";

const EVENTS = [
  { slug: "abuja-2026", label: "STAR Camp Abuja" },
  { slug: "owerri-2026", label: "STAR Camp Owerri" }
];

const TEAM_CHART_COLOURS = [
  "#6D28D9",
  "#9333EA",
  "#C026D3",
  "#DB2777",
  "#EA580C",
  "#CA8A04",
  "#16A34A",
  "#0891B2",
  "#2563EB",
  "#64748B"
];

type RangeDays = 7 | 30;

type TrendPoint = {
  date: string;
  label: string;
  registrants: number;
  revenue: number;
};

type TeamDistributionItem = {
  teamId: string | null;
  code: string | null;
  name: string;
  count: number;
};

type RegistrationStatusItem = {
  status: string;
  orders: number;
  attendees: number;
};

type DashboardData = {
  event: {
    id: string;
    name: string;
    slug: string;
    location: string;
    capacity: number | null;
  };
  rangeDays: RangeDays;
  metrics: {
    formattedTotalRevenue: string;
    totalPaidAttendees: number;
    pendingPaymentAttendees: number;

    currentlyCheckedIn: number;
    checkedOut: number;
    uniqueCheckedIn: number;
    attendancePercentage: number;

    badgeCounts: {
      pending: number;
      printed: number;
      issued: number;
    };

    ticketsNotEmailed: number;
    unassignedCount: number;
    paidAttendeesWithoutValidTickets: number;
    paymentFailuresLast24Hours: number;
    stalePendingAttendees: number;

    registrationTrend: TrendPoint[];
    periodRegistrantTotal: number;
    averageRegistrantsPerDay: number;

    teamDistribution: TeamDistributionItem[];
    registrationStatuses: RegistrationStatusItem[];
  };
};

function formatStatus(status: string) {
  return status
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(" ");
}

function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(value);
}

export default function AdminDashboardPage() {
  const [eventSlug, setEventSlug] = useState("abuja-2026");
  const [rangeDays, setRangeDays] = useState<RangeDays>(7);

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/dashboard?eventSlug=${encodeURIComponent(
          eventSlug
        )}&rangeDays=${rangeDays}`
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          window.location.href = "/admin/scan";
          return;
        }

        if (response.status === 401) {
          window.location.href = "/admin/login";
          return;
        }

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

    const interval = setInterval(loadDashboard, 30_000);

    return () => clearInterval(interval);
  }, [eventSlug, rangeDays]);

  const metrics = data?.metrics;

  const teamChartData =
    metrics?.teamDistribution.filter((team) => team.count > 0) ?? [];

  const assignedCount =
    metrics?.teamDistribution
      .filter((team) => team.teamId !== null)
      .reduce((sum, team) => sum + team.count, 0) ?? 0;

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
              Registration, payment, ticketing, team, and attendance overview.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={eventSlug}
              onChange={(event) =>
                setEventSlug(event.target.value)
              }
              className="rounded-2xl border border-purple-100 bg-white px-4 py-3"
            >
              {EVENTS.map((event) => (
                <option key={event.slug} value={event.slug}>
                  {event.label}
                </option>
              ))}
            </select>

            <Link
              href="/admin/logs"
              className="rounded-full border border-purple-200 bg-white px-6 py-3 text-center text-sm font-semibold text-royal"
            >
              View Logs
            </Link>

            <Link
              href="/admin/manage"
              className="rounded-full bg-royal px-6 py-3 text-center text-sm font-semibold text-white"
            >
              Manage Admins
            </Link>
          </div>
        </div>

        {loading && !data && (
          <p className="mt-8 text-muted">Loading dashboard...</p>
        )}

        {error && (
          <p className="mt-8 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">
            {error}
          </p>
        )}

        {metrics && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Paid Attendees"
                value={metrics.totalPaidAttendees}
              />

              <MetricCard
                label="Revenue Received"
                value={metrics.formattedTotalRevenue}
              />

              <MetricCard
                label="Pending Payment"
                value={metrics.pendingPaymentAttendees}
                detail="Attendees represented by pending orders"
              />

              <MetricCard
                label="Currently Checked In"
                value={metrics.currentlyCheckedIn}
                detail={`${metrics.attendancePercentage}% of paid attendees`}
              />

              <MetricCard
                label="Unassigned"
                value={metrics.unassignedCount}
                attention={metrics.unassignedCount > 0}
              />

              <MetricCard
                label="Tickets Not Emailed"
                value={metrics.ticketsNotEmailed}
                attention={metrics.ticketsNotEmailed > 0}
              />

              <MetricCard
                label="Badges Pending"
                value={metrics.badgeCounts.pending}
              />

              <MetricCard
                label="Badges Issued"
                value={metrics.badgeCounts.issued}
              />
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <Panel
                title="Registration Trend"
                action={
                  <div className="flex rounded-full border border-purple-200 bg-white p-1">
                    <RangeButton
                      active={rangeDays === 7}
                      onClick={() => setRangeDays(7)}
                    >
                      7 days
                    </RangeButton>

                    <RangeButton
                      active={rangeDays === 30}
                      onClick={() => setRangeDays(30)}
                    >
                      30 days
                    </RangeButton>
                  </div>
                }
              >
                <div className="mb-6 grid gap-3 sm:grid-cols-2">
                  <SmallMetric
                    label="Registrants in period"
                    value={metrics.periodRegistrantTotal}
                  />

                  <SmallMetric
                    label="Average per day"
                    value={metrics.averageRegistrantsPerDay}
                  />
                </div>

                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={metrics.registrationTrend}
                      margin={{
                        top: 10,
                        right: 12,
                        left: -18,
                        bottom: 0
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="registrationFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#6D28D9"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="95%"
                            stopColor="#6D28D9"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="4 4"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={rangeDays === 30 ? 18 : 8}
                      />

                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                      />

                      <Tooltip
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.date ?? ""
                        }
                        formatter={(value, name) => {
                          if (name === "registrants") {
                            return [
                              `${Number(value)} registrant${
                                Number(value) === 1 ? "" : "s"
                              }`,
                              "Registrants"
                            ];
                          }

                          return [String(value), String(name)];
                        }}
                      />

                      <Area
                        type="monotone"
                        dataKey="registrants"
                        stroke="#6D28D9"
                        strokeWidth={3}
                        fill="url(#registrationFill)"
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel title="Team Distribution">
                <div className="relative h-[320px] w-full">
                  {teamChartData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={teamChartData}
                            dataKey="count"
                            nameKey="name"
                            innerRadius={72}
                            outerRadius={112}
                            paddingAngle={2}
                          >
                            {teamChartData.map((team, index) => (
                              <Cell
                                key={team.teamId ?? "unassigned"}
                                fill={
                                  TEAM_CHART_COLOURS[
                                    index %
                                      TEAM_CHART_COLOURS.length
                                  ]
                                }
                              />
                            ))}
                          </Pie>

                          <Tooltip
                            formatter={(value, name) => {
                              const count = Number(value);
                              const total = teamChartData.reduce(
                                (sum, team) => sum + team.count,
                                0
                              );

                              const percentage =
                                total > 0
                                  ? (
                                      (count / total) *
                                      100
                                    ).toFixed(1)
                                  : "0.0";

                              return [
                                `${count} attendee${
                                  count === 1 ? "" : "s"
                                } · ${percentage}%`,
                                String(name)
                              ];
                            }}
                          />

                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-3xl font-black text-royalDark">
                            {assignedCount}
                          </p>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                            Assigned
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted">
                      No team assignments yet.
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {metrics.teamDistribution.map((team) => (
                    <div
                      key={team.teamId ?? "unassigned"}
                      className="flex items-center justify-between rounded-2xl bg-lavender px-4 py-3"
                    >
                      <span className="font-semibold text-royalDark">
                        {team.name}
                      </span>

                      <span className="font-black text-royal">
                        {team.count}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <Panel title="Registration Status">
                <div className="space-y-3">
                  {metrics.registrationStatuses.map((status) => (
                    <div
                      key={status.status}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-2xl border border-purple-100 p-4"
                    >
                      <p className="font-semibold text-royalDark">
                        {formatStatus(status.status)}
                      </p>

                      <div className="text-right">
                        <p className="font-black text-royal">
                          {status.attendees}
                        </p>
                        <p className="text-xs text-muted">
                          attendees
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-black text-royalDark">
                          {status.orders}
                        </p>
                        <p className="text-xs text-muted">
                          orders
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Needs Attention">
                <div className="space-y-3">
                  <AttentionRow
                    label="Paid attendees without a valid ticket"
                    value={
                      metrics.paidAttendeesWithoutValidTickets
                    }
                    urgent={
                      metrics.paidAttendeesWithoutValidTickets > 0
                    }
                  />

                  <AttentionRow
                    label="Valid tickets not emailed"
                    value={metrics.ticketsNotEmailed}
                    urgent={metrics.ticketsNotEmailed > 0}
                  />

                  <AttentionRow
                    label="Attendees without a team"
                    value={metrics.unassignedCount}
                    urgent={metrics.unassignedCount > 0}
                  />

                  <AttentionRow
                    label="Pending payment for over 2 hours"
                    value={metrics.stalePendingAttendees}
                    urgent={metrics.stalePendingAttendees > 0}
                  />

                  <AttentionRow
                    label="Payment failures in the last 24 hours"
                    value={metrics.paymentFailuresLast24Hours}
                    urgent={
                      metrics.paymentFailuresLast24Hours > 0
                    }
                  />
                </div>
              </Panel>
            </section>

            <section className="mt-8">
              <Panel
                title="Camp-Day Operations"
                action={
                  <Link
                    href="/admin/logs"
                    className="text-sm font-semibold text-royal"
                  >
                    View operational logs →
                  </Link>
                }
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <SmallMetric
                    label="Currently checked in"
                    value={metrics.currentlyCheckedIn}
                  />

                  <SmallMetric
                    label="Ever checked in"
                    value={metrics.uniqueCheckedIn}
                  />

                  <SmallMetric
                    label="Checked out"
                    value={metrics.checkedOut}
                  />

                  <SmallMetric
                    label="Badges printed"
                    value={metrics.badgeCounts.printed}
                  />

                  <SmallMetric
                    label="Badges issued"
                    value={metrics.badgeCounts.issued}
                  />
                </div>

                <div className="mt-6">
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="font-semibold text-royalDark">
                      Current attendance
                    </span>

                    <span className="text-muted">
                      {metrics.currentlyCheckedIn} of{" "}
                      {metrics.totalPaidAttendees}
                    </span>
                  </div>

                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-lavender">
                    <div
                      className="h-full rounded-full bg-royal transition-all"
                      style={{
                        width: `${Math.min(
                          metrics.attendancePercentage,
                          100
                        )}%`
                      }}
                    />
                  </div>
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
  value,
  detail,
  attention = false
}: {
  label: string;
  value: string | number;
  detail?: string;
  attention?: boolean;
}) {
  return (
    <div
      className={`rounded-[2rem] border bg-white p-6 shadow-soft ${
        attention
          ? "border-amber-200"
          : "border-purple-100"
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </p>

      <p className="mt-3 text-3xl font-black text-royalDark">
        {value}
      </p>

      {detail && (
        <p className="mt-2 text-sm text-muted">{detail}</p>
      )}
    </div>
  );
}

function SmallMetric({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-lavender p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-royalDark">
        {value}
      </p>
    </div>
  );
}

function AttentionRow({
  label,
  value,
  urgent
}: {
  label: string;
  value: number;
  urgent: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-4 py-4 ${
        urgent
          ? "border-amber-200 bg-amber-50"
          : "border-green-100 bg-green-50"
      }`}
    >
      <p
        className={
          urgent
            ? "font-semibold text-amber-900"
            : "font-semibold text-green-800"
        }
      >
        {label}
      </p>

      <span
        className={`text-xl font-black ${
          urgent ? "text-amber-800" : "text-green-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function RangeButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${
        active
          ? "bg-royal text-white"
          : "text-royal hover:bg-lavender"
      }`}
    >
      {children}
    </button>
  );
}

function Panel({
  title,
  action,
  children
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-2xl font-semibold text-royalDark">
          {title}
        </h2>

        {action}
      </div>

      <div className="mt-5">{children}</div>
    </div>
  );
}