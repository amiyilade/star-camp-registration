import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/get-admin-user";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const admin = await getAdminUser();

  if (!admin) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  }

  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const eventSlug = request.nextUrl.searchParams.get("eventSlug") ?? "all";

  if (search.length < 2) {
    return NextResponse.json({
      attendees: [],
      events: []
    });
  }

  let allowedEventIds: string[] = [];

  if (admin.is_super_admin) {
    const { data: events, error: eventsError } = await supabaseAdmin
      .from("events")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name");

    if (eventsError) {
      return NextResponse.json(
        { error: eventsError.message },
        { status: 500 }
      );
    }

    const selectedEvents =
      eventSlug === "all"
        ? events ?? []
        : (events ?? []).filter((event) => event.slug === eventSlug);

    allowedEventIds = selectedEvents.map((event) => event.id);

    if (allowedEventIds.length === 0) {
      return NextResponse.json({
        attendees: [],
        events: events ?? []
      });
    }

    const attendees = await searchAttendees(search, allowedEventIds);

    return NextResponse.json({
      attendees,
      events: events ?? []
    });
  }

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("admin_event_roles")
    .select(`
      event_id,
      events (
        id,
        name,
        slug
      )
    `)
    .eq("admin_user_id", admin.id)
    .eq("is_active", true);

  if (rolesError) {
    return NextResponse.json(
      { error: rolesError.message },
      { status: 500 }
    );
  }

  const assignedEvents =
    roles?.map((role: any) => {
      const event = Array.isArray(role.events)
        ? role.events[0]
        : role.events;

      return event;
    }).filter(Boolean) ?? [];

  const selectedEvents =
    eventSlug === "all"
      ? assignedEvents
      : assignedEvents.filter((event: any) => event.slug === eventSlug);

  allowedEventIds = selectedEvents.map((event: any) => event.id);

  if (allowedEventIds.length === 0) {
    return NextResponse.json({
      attendees: [],
      events: assignedEvents
    });
  }

  const attendees = await searchAttendees(search, allowedEventIds);

  return NextResponse.json({
    attendees,
    events: assignedEvents
  });
}

async function searchAttendees(search: string, allowedEventIds: string[]) {
  const normalized = search.trim();

  const baseSelect = `
    id,
    event_id,
    first_name,
    last_name,
    email,
    phone_country_code,
    phone_number,
    age_at_registration,
    department,
    guardian_name,
    guardian_phone_country_code,
    guardian_phone_number,
    emergency_contact_name,
    emergency_contact_phone_country_code,
    emergency_contact_phone_number,
    events (
      name,
      slug,
      location
    ),
    tickets (
      id,
      ticket_code,
      qr_token,
      status,
      checked_in_at,
      checked_out_at,
      badge_status,
      badge_printed_at,
      badge_issued_at,
      teams:assigned_team_id (
        code,
        name
      )
    )
  `;

  const { data: attendeeMatches, error: attendeeError } =
    await supabaseAdmin
      .from("attendees")
      .select(baseSelect)
      .in("event_id", allowedEventIds)
      .or(
        [
          `first_name.ilike.%${normalized}%`,
          `last_name.ilike.%${normalized}%`,
          `email.ilike.%${normalized}%`,
          `phone_number.ilike.%${normalized}%`,
          `guardian_phone_number.ilike.%${normalized}%`,
          `emergency_contact_phone_number.ilike.%${normalized}%`
        ].join(",")
      )
      .limit(20);

  if (attendeeError) {
    throw new Error(attendeeError.message);
  }

  const { data: ticketMatches, error: ticketError } =
    await supabaseAdmin
      .from("tickets")
      .select(`
        attendee_id
      `)
      .in("event_id", allowedEventIds)
      .ilike("ticket_code", `%${normalized}%`)
      .limit(20);

  if (ticketError) {
    throw new Error(ticketError.message);
  }

  const ticketAttendeeIds =
    ticketMatches?.map((ticket) => ticket.attendee_id).filter(Boolean) ?? [];

  let ticketAttendeeMatches: any[] = [];

  if (ticketAttendeeIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("attendees")
      .select(baseSelect)
      .in("id", ticketAttendeeIds)
      .in("event_id", allowedEventIds);

    if (error) {
      throw new Error(error.message);
    }

    ticketAttendeeMatches = data ?? [];
  }

  const combined = [
    ...(attendeeMatches ?? []),
    ...ticketAttendeeMatches
  ];

  const uniqueById = new Map();

  for (const attendee of combined) {
    uniqueById.set(attendee.id, attendee);
  }

  return Array.from(uniqueById.values()).slice(0, 20);
}