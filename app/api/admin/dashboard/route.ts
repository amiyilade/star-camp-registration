import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/get-admin-user";
import { requireAdminForEvent } from "@/lib/auth/require-admin-for-event";
import { supabaseAdmin } from "@/lib/supabase/server";

function money(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(amount);
}

export async function GET(request: NextRequest) {
  const admin = await getAdminUser();

  if (!admin) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const eventSlug =
    request.nextUrl.searchParams.get("eventSlug") ?? "abuja-2026";

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("id, name, slug")
    .eq("slug", eventSlug)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const access = await requireAdminForEvent(event.id);

  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const { data: paidOrders } = await supabaseAdmin
    .from("registration_orders")
    .select("id, ticket_quantity, total_amount_ngn, created_at")
    .eq("event_id", event.id)
    .eq("status", "paid");

  const { data: tickets } = await supabaseAdmin
    .from("tickets")
    .select(`
      id,
      checked_in_at,
      checked_out_at,
      badge_status,
      teams:assigned_team_id (
        code,
        name
      )
    `)
    .eq("event_id", event.id);

  const { data: recentLogs } = await supabaseAdmin
    .from("checkin_logs")
    .select(`
      action,
      admin_email,
      created_at,
      tickets (
        ticket_code
      ),
      attendees (
        first_name,
        last_name
      )
    `)
    .eq("event_id", event.id)
    .in("action", ["check_in", "check_out", "duplicate_attempt"])
    .order("created_at", { ascending: false })
    .limit(15);

  const totalRevenue = paidOrders?.reduce(
    (sum, order) => sum + (order.total_amount_ngn ?? 0),
    0
  ) ?? 0;

  const totalPaidAttendees = paidOrders?.reduce(
    (sum, order) => sum + (order.ticket_quantity ?? 0),
    0
  ) ?? 0;

  const currentlyCheckedIn =
    tickets?.filter((ticket) => {
      if (!ticket.checked_in_at) return false;
      if (!ticket.checked_out_at) return true;

      return (
        new Date(ticket.checked_in_at) > new Date(ticket.checked_out_at)
      );
    }).length ?? 0;

  const checkedOut =
    tickets?.filter((ticket) => {
      if (!ticket.checked_in_at || !ticket.checked_out_at) return false;

      return (
        new Date(ticket.checked_out_at) > new Date(ticket.checked_in_at)
      );
    }).length ?? 0;

  const badgeCounts = {
    pending: tickets?.filter((ticket) => ticket.badge_status === "pending").length ?? 0,
    printed: tickets?.filter((ticket) => ticket.badge_status === "printed").length ?? 0,
    issued: tickets?.filter((ticket) => ticket.badge_status === "issued").length ?? 0
  };

  const teamCounts =
    tickets?.reduce<Record<string, number>>((acc, ticket: any) => {
      const team = Array.isArray(ticket.teams)
        ? ticket.teams[0]
        : ticket.teams;

      const label = team?.name ?? "Unassigned";

      acc[label] = (acc[label] ?? 0) + 1;

      return acc;
    }, {}) ?? {};

  const registrationTrends =
    paidOrders?.reduce<Record<string, { tickets: number; revenue: number }>>(
      (acc, order) => {
        const date = new Date(order.created_at).toISOString().slice(0, 10);

        if (!acc[date]) {
          acc[date] = { tickets: 0, revenue: 0 };
        }

        acc[date].tickets += order.ticket_quantity ?? 0;
        acc[date].revenue += order.total_amount_ngn ?? 0;

        return acc;
      },
      {}
    ) ?? {};

  return NextResponse.json({
    event,
    metrics: {
      totalRevenue,
      formattedTotalRevenue: money(totalRevenue),
      refundedRevenue: 0,
      formattedRefundedRevenue: money(0),
      totalPaidAttendees,
      currentlyCheckedIn,
      checkedOut,
      badgeCounts,
      teamCounts,
      registrationTrends,
      recentLogs: recentLogs ?? []
    }
  });
}