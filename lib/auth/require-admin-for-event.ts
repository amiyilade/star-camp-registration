import { getAdminUser } from "@/lib/auth/get-admin-user";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function requireAdminForEvent(eventId: string) {
  const admin = await getAdminUser();

  if (!admin) {
    return {
      allowed: false,
      status: 401,
      error: "Not authenticated.",
      admin: null
    };
  }

  if (admin.is_super_admin) {
    return {
      allowed: true,
      status: 200,
      error: null,
      admin
    };
  }

  const { data: role, error } = await supabaseAdmin
    .from("admin_event_roles")
    .select("id, role, is_active")
    .eq("admin_user_id", admin.id)
    .eq("event_id", eventId)
    .eq("is_active", true)
    .single();

  if (error || !role) {
    return {
      allowed: false,
      status: 403,
      error: "You do not have access to this event.",
      admin
    };
  }

  return {
    allowed: true,
    status: 200,
    error: null,
    admin,
    role
  };
}