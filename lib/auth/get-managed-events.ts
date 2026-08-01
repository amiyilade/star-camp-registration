import { getAdminUser } from "@/lib/auth/get-admin-user";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function getManagedEvents() {
  const admin = await getAdminUser();

  if (!admin) {
    return {
      admin: null,
      events: []
    };
  }

  if (admin.is_super_admin) {
    const { data: events, error } = await supabaseAdmin
      .from("events")
      .select(`
        id,
        name,
        slug,
        location,
        capacity,
        date_start,
        date_end,
        is_active
      `)
      .eq("is_active", true)
      .order("name");

    if (error) {
      throw new Error(error.message);
    }

    return {
      admin,
      events: events ?? []
    };
  }

  const { data: roles, error } = await supabaseAdmin
    .from("admin_event_roles")
    .select(`
      event_id,
      events!inner (
        id,
        name,
        slug,
        location,
        capacity,
        date_start,
        date_end,
        is_active
      )
    `)
    .eq("admin_user_id", admin.id)
    .eq("role", "manager")
    .eq("is_active", true)
    .eq("events.is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  const events =
    roles
      ?.map((role) => {
        return Array.isArray(role.events)
          ? role.events[0]
          : role.events;
      })
      .filter(
        (
          event
        ): event is NonNullable<typeof event> =>
          Boolean(event)
      ) ?? [];

  return {
    admin,
    events
  };
}