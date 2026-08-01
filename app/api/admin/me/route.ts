import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/get-admin-user";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const admin = await getAdminUser();

  if (!admin) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  }

  const { data: roleRows, error } = await supabaseAdmin
    .from("admin_event_roles")
    .select(`
      id,
      event_id,
      role,
      is_active,
      events (
        id,
        slug,
        name,
        location
      )
    `)
    .eq("admin_user_id", admin.id)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const roles = (roleRows ?? []).map((row) => {
    const event = Array.isArray(row.events)
      ? row.events[0]
      : row.events;

    return {
      id: row.id,
      eventId: row.event_id,
      role: row.role,
      event
    };
  });

  const managedEvents = roles
    .filter((role) => role.role === "manager")
    .map((role) => role.event)
    .filter(Boolean);

  const accessibleEvents = roles
    .map((role) => role.event)
    .filter(Boolean);

  return NextResponse.json({
    admin,
    roles,
    permissions: {
      isSuperAdmin: admin.is_super_admin,
      canViewDashboard:
        admin.is_super_admin || managedEvents.length > 0,
      canViewLogs:
        admin.is_super_admin || managedEvents.length > 0,
      canManageEventAdmins:
        admin.is_super_admin || managedEvents.length > 0,
      canManageSuperAdmins: admin.is_super_admin
    },
    managedEvents,
    accessibleEvents
  });
}