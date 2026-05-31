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

  if (!admin.is_super_admin) {
    return NextResponse.json(
      { error: "Not authorized." },
      { status: 403 }
    );
  }

  const { data: admins, error } =
    await supabaseAdmin
      .from("admin_users")
      .select(`
        *,
        admin_event_roles (
          role,
          is_active,
          events (
            id,
            name,
            slug
          )
        )
      `)
      .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    admins
  });
}

export async function POST(request: Request) {
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

  const body = await request.json();

  const {
    email,
    fullName,
    isSuperAdmin,
    role,
    eventSlugs
  } = body as {
    email: string;
    fullName: string;
    isSuperAdmin: boolean;
    role: "scanner" | "manager";
    eventSlugs: string[];
  };

  if (!email || !fullName) {
    return NextResponse.json(
      { error: "Email and full name are required." },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!isSuperAdmin) {
  const { data: existingAdmin } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, is_super_admin")
    .eq("email", normalizedEmail)
    .single();

  if (existingAdmin?.is_super_admin) {
    const { count, error: countError } = await supabaseAdmin
      .from("admin_users")
      .select("*", { count: "exact", head: true })
      .eq("is_super_admin", true)
      .eq("is_active", true);

    if (countError) {
      return NextResponse.json(
        { error: countError.message },
        { status: 500 }
      );
    }

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        {
          error:
            "You cannot remove the last active super admin. Add another super admin first."
        },
        { status: 400 }
      );
    }
  }
}
  if (normalizedEmail === admin.email && !isSuperAdmin) {
    return NextResponse.json(
        {
        error:
            "You cannot demote your own account from the admin management page."
        },
        { status: 400 }
    );
    }

  const { data: adminUser, error: adminError } = await supabaseAdmin
    .from("admin_users")
    .upsert(
      {
        email: normalizedEmail,
        full_name: fullName.trim(),
        is_super_admin: isSuperAdmin,
        is_active: true
      },
      { onConflict: "email" }
    )
    .select("id, email")
    .single();

  if (adminError || !adminUser) {
    return NextResponse.json(
      { error: adminError?.message ?? "Could not save admin user." },
      { status: 500 }
    );
  }

  if (!isSuperAdmin) {
    const { error: deactivateError } = await supabaseAdmin
      .from("admin_event_roles")
      .update({ is_active: false })
      .eq("admin_user_id", adminUser.id);

    if (deactivateError) {
      return NextResponse.json(
        { error: deactivateError.message },
        { status: 500 }
      );
    }

    if (eventSlugs.length > 0) {
      const { data: events, error: eventsError } = await supabaseAdmin
        .from("events")
        .select("id, slug")
        .in("slug", eventSlugs);

      if (eventsError || !events) {
        return NextResponse.json(
          { error: eventsError?.message ?? "Could not fetch events." },
          { status: 500 }
        );
      }

      const roleRows = events.map((event) => ({
        admin_user_id: adminUser.id,
        event_id: event.id,
        role,
        is_active: true,
        invited_by_email: admin.email
      }));

      const { error: roleError } = await supabaseAdmin
        .from("admin_event_roles")
        .upsert(roleRows, {
          onConflict: "admin_user_id,event_id"
        });

      if (roleError) {
        return NextResponse.json(
          { error: roleError.message },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({
    message: "Admin saved successfully."
  });
}