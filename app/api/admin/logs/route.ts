import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/get-admin-user";
import { supabaseAdmin } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
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
    request.nextUrl.searchParams.get("eventSlug") ?? "all";

  const action =
    request.nextUrl.searchParams.get("action") ?? "all";

  const page = Math.max(
    1,
    Number(request.nextUrl.searchParams.get("page") ?? "1")
  );

  const offset = (page - 1) * PAGE_SIZE;

  let eventId: string | null = null;

  if (eventSlug !== "all") {
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("slug", eventSlug)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found." },
        { status: 404 }
      );
    }

    eventId = event.id;
  }

  let checkinQuery = supabaseAdmin
    .from("checkin_logs")
    .select(`
      id,
      admin_user_id,
      admin_email,
      action,
      notes,
      created_at,
      ticket_id,
      attendee_id,
      event_id,
      attendees (
        first_name,
        last_name
      ),
      tickets (
        ticket_code
      ),
      events (
        name,
        slug
      )
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  let activityQuery = supabaseAdmin
    .from("admin_activity_logs")
    .select(`
      id,
      admin_user_id,
      admin_email,
      action,
      outcome,
      notes,
      metadata,
      created_at,
      ticket_id,
      attendee_id,
      event_id,
      attendees (
        first_name,
        last_name
      ),
      tickets (
        ticket_code
      ),
      events (
        name,
        slug
      )
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (eventId) {
    checkinQuery = checkinQuery.eq("event_id", eventId);
    activityQuery = activityQuery.eq("event_id", eventId);
  }

  if (action !== "all") {
    checkinQuery = checkinQuery.eq("action", action);
    activityQuery = activityQuery.eq("action", action);
  }

  const [
    { data: checkinLogs, error: checkinError },
    { data: activityLogs, error: activityError },
    { data: events, error: eventsError }
  ] = await Promise.all([
    checkinQuery,
    activityQuery,
    supabaseAdmin
      .from("events")
      .select("id, name, slug")
      .order("name")
  ]);

  if (checkinError || activityError || eventsError) {
    console.error("Admin logs query failed:", {
      checkinError,
      activityError,
      eventsError
    });

    return NextResponse.json(
      { error: "Could not load operational logs." },
      { status: 500 }
    );
  }

  const normalizedCheckinLogs = (checkinLogs ?? []).map((log) => ({
    ...log,
    source: "checkin",
    outcome:
      log.action === "access_denied"
        ? "denied"
        : log.action === "duplicate_attempt"
          ? "failure"
          : "success",
    metadata: {}
  }));

  const normalizedActivityLogs = (activityLogs ?? []).map((log) => ({
    ...log,
    source: "admin_activity"
  }));

  const logs = [
    ...normalizedCheckinLogs,
    ...normalizedActivityLogs
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .slice(0, PAGE_SIZE);

  return NextResponse.json({
    logs,
    events: events ?? [],
    page,
    pageSize: PAGE_SIZE
  });
}