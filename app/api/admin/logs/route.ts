import { NextRequest, NextResponse } from "next/server";

import { getManagedEvents } from "@/lib/auth/get-managed-events";
import { supabaseAdmin } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const { admin, events } = await getManagedEvents();

    if (!admin) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    if (events.length === 0) {
      return NextResponse.json(
        {
          error:
            "You do not have manager access to any active event."
        },
        { status: 403 }
      );
    }

    const eventSlug =
      request.nextUrl.searchParams.get("eventSlug") ?? "all";

    const action =
      request.nextUrl.searchParams.get("action") ?? "all";

    const requestedPage = Number(
      request.nextUrl.searchParams.get("page") ?? "1"
    );

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const offset = (page - 1) * PAGE_SIZE;

    const accessibleEventIds = events.map(
      (event) => event.id
    );

    let selectedEventId: string | null = null;

    if (eventSlug !== "all") {
      const selectedEvent = events.find(
        (event) => event.slug === eventSlug
      );

      if (!selectedEvent) {
        return NextResponse.json(
          {
            error:
              "You do not have manager access to the selected event."
          },
          { status: 403 }
        );
      }

      selectedEventId = selectedEvent.id;
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

    if (selectedEventId) {
      checkinQuery = checkinQuery.eq(
        "event_id",
        selectedEventId
      );

      activityQuery = activityQuery.eq(
        "event_id",
        selectedEventId
      );
    } else if (!admin.is_super_admin) {
      /*
       * Managers selecting "all" may see all of their managed events,
       * but never events outside their authorization scope.
       *
       * This also excludes global logs whose event_id is null.
       */
      checkinQuery = checkinQuery.in(
        "event_id",
        accessibleEventIds
      );

      activityQuery = activityQuery.in(
        "event_id",
        accessibleEventIds
      );
    }

    if (action !== "all") {
      checkinQuery = checkinQuery.eq("action", action);
      activityQuery = activityQuery.eq("action", action);
    }

    const [
      checkinResult,
      activityResult
    ] = await Promise.all([
      checkinQuery,
      activityQuery
    ]);

    if (checkinResult.error || activityResult.error) {
      console.error("Admin logs query failed:", {
        checkinError: checkinResult.error,
        activityError: activityResult.error
      });

      return NextResponse.json(
        { error: "Could not load operational logs." },
        { status: 500 }
      );
    }

    const normalizedCheckinLogs = (
      checkinResult.data ?? []
    ).map((log) => ({
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

    const normalizedActivityLogs = (
      activityResult.data ?? []
    ).map((log) => ({
      ...log,
      source: "admin_activity"
    }));

    const logs = [
      ...normalizedCheckinLogs,
      ...normalizedActivityLogs
    ]
      .sort(
        (first, second) =>
          new Date(second.created_at).getTime() -
          new Date(first.created_at).getTime()
      )
      .slice(0, PAGE_SIZE);

    return NextResponse.json({
      logs,
      events: events.map((event) => ({
        id: event.id,
        name: event.name,
        slug: event.slug,
        location: event.location
      })),
      viewer: {
        isSuperAdmin: admin.is_super_admin
      },
      page,
      pageSize: PAGE_SIZE
    });
  } catch (error) {
    console.error("Admin logs API error:", error);

    return NextResponse.json(
      { error: "Unexpected operational-logs error." },
      { status: 500 }
    );
  }
}