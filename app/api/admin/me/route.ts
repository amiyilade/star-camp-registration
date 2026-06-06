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

  const { data: roles, error } = await supabaseAdmin
    .from("admin_event_roles")
    .select(`
      role,
      is_active,
      events (
        slug,
        name
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

  return NextResponse.json({
    admin,
    roles: roles ?? []
  });
}