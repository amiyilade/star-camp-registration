import { getAdminUser } from "@/lib/auth/get-admin-user";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function requireManagerForEvent(eventId: string) {
  const admin = await getAdminUser();

  if (!admin) {
    return {
      allowed: false as const,
      status: 401,
      error: "Not authenticated.",
      admin: null,
      role: null
    };
  }

  if (admin.is_super_admin) {
    return {
      allowed: true as const,
      status: 200,
      error: null,
      admin,
      role: {
        id: null,
        role: "super_admin" as const,
        event_id: eventId
      }
    };
  }

  const { data: role, error } = await supabaseAdmin
    .from("admin_event_roles")
    .select("id, event_id, role, is_active")
    .eq("admin_user_id", admin.id)
    .eq("event_id", eventId)
    .eq("role", "manager")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !role) {
    return {
      allowed: false as const,
      status: 403,
      error: "Manager access is required for this event.",
      admin,
      role: null
    };
  }

  return {
    allowed: true as const,
    status: 200,
    error: null,
    admin,
    role
  };
}