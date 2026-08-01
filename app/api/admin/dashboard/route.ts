import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/get-admin-user";
import { requireAdminForEvent } from "@/lib/auth/require-admin-for-event";
import { supabaseAdmin } from "@/lib/supabase/server";

const LAGOS_TIME_ZONE = "Africa/Lagos";

function money(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(amount);
}

function getLagosDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LAGOS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Could not format Lagos date.");
  }

  return `${year}-${month}-${day}`;
}

function getDateKeys(numberOfDays: number) {
  const todayKey = getLagosDateKey(new Date());

  const [year, month, day] = todayKey
    .split("-")
    .map((part) => Number(part));

  const today = new Date(Date.UTC(year, month - 1, day));

  return Array.from({ length: numberOfDays }, (_, index) => {
    const date = new Date(today);

    date.setUTCDate(
      today.getUTCDate() - (numberOfDays - 1 - index)
    );

    return date.toISOString().slice(0, 10);
  });
}

function getDateLabel(dateKey: string, rangeDays: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: rangeDays === 7 ? "short" : "short"
  }).format(date);
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser();

    if (!admin) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    if (!admin.is_super_admin) {
      return NextResponse.json(
        { error: "Not authorized." },
        { status: 403 }
      );
    }

    const eventSlug =
      request.nextUrl.searchParams.get("eventSlug") ?? "abuja-2026";

    const requestedRange = Number(
      request.nextUrl.searchParams.get("rangeDays") ?? "7"
    );

    const rangeDays = requestedRange === 30 ? 30 : 7;

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, name, slug, location, capacity")
      .eq("slug", eventSlug)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found." },
        { status: 404 }
      );
    }

    const access = await requireAdminForEvent(event.id);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const [
      paidOrdersResult,
      allOrdersResult,
      ticketsResult,
      teamsResult,
      paymentFailuresResult
    ] = await Promise.all([
      supabaseAdmin
        .from("registration_orders")
        .select(`
          id,
          ticket_quantity,
          total_amount_ngn,
          paid_at,
          created_at
        `)
        .eq("event_id", event.id)
        .eq("status", "paid"),

      supabaseAdmin
        .from("registration_orders")
        .select(`
          id,
          status,
          ticket_quantity,
          created_at
        `)
        .eq("event_id", event.id),

      supabaseAdmin
        .from("tickets")
        .select(`
          id,
          status,
          email_sent_at,
          checked_in_at,
          checked_out_at,
          badge_status,
          assigned_team_id,
          registration_orders!inner (
            status
          ),
          teams:assigned_team_id (
            id,
            code,
            name
          )
        `)
        .eq("event_id", event.id)
        .eq("registration_orders.status", "paid"),

      supabaseAdmin
        .from("teams")
        .select("id, code, name")
        .eq("event_id", event.id)
        .order("name"),

      supabaseAdmin
        .from("payment_failure_logs")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id)
        .gte(
          "created_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        )
    ]);

    if (
      paidOrdersResult.error ||
      allOrdersResult.error ||
      ticketsResult.error ||
      teamsResult.error ||
      paymentFailuresResult.error
    ) {
      console.error("Dashboard query error:", {
        paidOrdersError: paidOrdersResult.error,
        allOrdersError: allOrdersResult.error,
        ticketsError: ticketsResult.error,
        teamsError: teamsResult.error,
        paymentFailuresError: paymentFailuresResult.error
      });

      return NextResponse.json(
        { error: "Could not load dashboard data." },
        { status: 500 }
      );
    }

    const paidOrders = paidOrdersResult.data ?? [];
    const allOrders = allOrdersResult.data ?? [];
    const allPaidOrderTickets = ticketsResult.data ?? [];
    const teams = teamsResult.data ?? [];

    // Only a paid order combined with a valid ticket is operationally valid.
    const validTickets = allPaidOrderTickets.filter(
      (ticket) => ticket.status === "valid"
    );

    const totalRevenue = paidOrders.reduce(
      (sum, order) => sum + (order.total_amount_ngn ?? 0),
      0
    );

    const totalPaidAttendees = paidOrders.reduce(
      (sum, order) => sum + (order.ticket_quantity ?? 0),
      0
    );

    const pendingPaymentAttendees = allOrders
      .filter((order) => order.status === "pending_payment")
      .reduce(
        (sum, order) => sum + (order.ticket_quantity ?? 0),
        0
      );

    const currentlyCheckedIn = validTickets.filter((ticket) => {
      if (!ticket.checked_in_at) {
        return false;
      }

      if (!ticket.checked_out_at) {
        return true;
      }

      return (
        new Date(ticket.checked_in_at) >
        new Date(ticket.checked_out_at)
      );
    }).length;

    const checkedOut = validTickets.filter((ticket) => {
      if (!ticket.checked_in_at || !ticket.checked_out_at) {
        return false;
      }

      return (
        new Date(ticket.checked_out_at) >
        new Date(ticket.checked_in_at)
      );
    }).length;

    const uniqueCheckedIn = validTickets.filter(
      (ticket) => Boolean(ticket.checked_in_at)
    ).length;

    const attendancePercentage =
      totalPaidAttendees > 0
        ? Math.round(
            (currentlyCheckedIn / totalPaidAttendees) * 1000
          ) / 10
        : 0;

    const badgeCounts = {
      pending: validTickets.filter(
        (ticket) => ticket.badge_status === "pending"
      ).length,
      printed: validTickets.filter(
        (ticket) => ticket.badge_status === "printed"
      ).length,
      issued: validTickets.filter(
        (ticket) => ticket.badge_status === "issued"
      ).length
    };

    /*
     * Initialize all teams with zero so teams without assignments remain
     * visible in the legend/list.
     */
    const teamCountMap = new Map<
      string,
      {
        teamId: string | null;
        code: string | null;
        name: string;
        count: number;
      }
    >();

    for (const team of teams) {
      teamCountMap.set(team.id, {
        teamId: team.id,
        code: team.code,
        name: team.name,
        count: 0
      });
    }

    teamCountMap.set("unassigned", {
      teamId: null,
      code: null,
      name: "Unassigned",
      count: 0
    });

    for (const ticket of validTickets) {
      const team = Array.isArray(ticket.teams)
        ? ticket.teams[0]
        : ticket.teams;

      const key = team?.id ?? "unassigned";
      const existing = teamCountMap.get(key);

      if (existing) {
        existing.count += 1;
      } else if (team) {
        teamCountMap.set(key, {
          teamId: team.id,
          code: team.code,
          name: team.name,
          count: 1
        });
      }
    }

    const teamDistribution = Array.from(teamCountMap.values());

    const unassignedCount =
      teamDistribution.find((team) => team.teamId === null)?.count ?? 0;

    const ticketsNotEmailed = validTickets.filter(
      (ticket) => !ticket.email_sent_at
    ).length;

    const paidAttendeesWithoutValidTickets = Math.max(
      totalPaidAttendees - validTickets.length,
      0
    );

    const stalePendingThreshold =
      Date.now() - 2 * 60 * 60 * 1000;

    const stalePendingAttendees = allOrders
      .filter(
        (order) =>
          order.status === "pending_payment" &&
          new Date(order.created_at).getTime() <
            stalePendingThreshold
      )
      .reduce(
        (sum, order) => sum + (order.ticket_quantity ?? 0),
        0
      );

    const statusMap = new Map<
      string,
      { status: string; orders: number; attendees: number }
    >([
      ["paid", { status: "paid", orders: 0, attendees: 0 }],
      [
        "pending_payment",
        { status: "pending_payment", orders: 0, attendees: 0 }
      ],
      ["draft", { status: "draft", orders: 0, attendees: 0 }],
      [
        "cancelled",
        { status: "cancelled", orders: 0, attendees: 0 }
      ],
      ["expired", { status: "expired", orders: 0, attendees: 0 }]
    ]);

    for (const order of allOrders) {
      const current =
        statusMap.get(order.status) ?? {
          status: order.status,
          orders: 0,
          attendees: 0
        };

      current.orders += 1;
      current.attendees += order.ticket_quantity ?? 0;

      statusMap.set(order.status, current);
    }

    const registrationStatuses = Array.from(statusMap.values());

    const dateKeys = getDateKeys(rangeDays);

    const trendMap = new Map(
      dateKeys.map((dateKey) => [
        dateKey,
        {
          date: dateKey,
          label: getDateLabel(dateKey, rangeDays),
          registrants: 0,
          revenue: 0
        }
      ])
    );

    for (const order of paidOrders) {
      // A paid registration must be grouped by the time payment completed.
      if (!order.paid_at) {
        continue;
      }

      const dateKey = getLagosDateKey(order.paid_at);
      const trendEntry = trendMap.get(dateKey);

      if (!trendEntry) {
        continue;
      }

      trendEntry.registrants += order.ticket_quantity ?? 0;
      trendEntry.revenue += order.total_amount_ngn ?? 0;
    }

    const registrationTrend = Array.from(trendMap.values());

    const periodRegistrantTotal = registrationTrend.reduce(
      (sum, day) => sum + day.registrants,
      0
    );

    const averageRegistrantsPerDay =
      Math.round((periodRegistrantTotal / rangeDays) * 10) / 10;

    return NextResponse.json({
      event,
      rangeDays,
      metrics: {
        totalRevenue,
        formattedTotalRevenue: money(totalRevenue),

        totalPaidAttendees,
        pendingPaymentAttendees,

        currentlyCheckedIn,
        checkedOut,
        uniqueCheckedIn,
        attendancePercentage,

        badgeCounts,

        ticketsNotEmailed,
        unassignedCount,
        paidAttendeesWithoutValidTickets,

        paymentFailuresLast24Hours:
          paymentFailuresResult.count ?? 0,

        stalePendingAttendees,

        registrationTrend,
        periodRegistrantTotal,
        averageRegistrantsPerDay,

        teamDistribution,
        registrationStatuses
      }
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    return NextResponse.json(
      { error: "Unexpected dashboard error." },
      { status: 500 }
    );
  }
}