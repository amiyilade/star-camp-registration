import { NextRequest, NextResponse } from "next/server";

import { logAdminActivity } from "@/lib/admin/log-admin-activity";
import { requireManagerForEvent } from "@/lib/auth/require-manager-for-event";
import { supabaseAdmin } from "@/lib/supabase/server";

type EventRole = "scanner" | "manager";

async function getEvent(eventSlug: string) {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, name, slug, location")
    .eq("slug", eventSlug)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

async function countActiveManagers(eventId: string) {
  const { count, error } = await supabaseAdmin
    .from("admin_event_roles")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("role", "manager")
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function GET(request: NextRequest) {
  try {
    const eventSlug =
      request.nextUrl.searchParams.get("eventSlug")?.trim();

    if (!eventSlug) {
      return NextResponse.json(
        { error: "Event slug is required." },
        { status: 400 }
      );
    }

    const event = await getEvent(eventSlug);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found." },
        { status: 404 }
      );
    }

    const access = await requireManagerForEvent(event.id);

    if (!access.allowed || !access.admin) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    let roleQuery = supabaseAdmin
      .from("admin_event_roles")
      .select(`
        id,
        role,
        is_active,
        created_at,
        updated_at,
        updated_by_email,
        admin_users!inner (
          id,
          email,
          full_name,
          is_super_admin,
          is_active
        )
      `)
      .eq("event_id", event.id)
      .eq("is_active", true)
      .eq("admin_users.is_active", true)
      .order("created_at", { ascending: false });

    // Managers must not receive information about super-admin accounts.
    if (!access.admin.is_super_admin) {
      roleQuery = roleQuery.eq(
        "admin_users.is_super_admin",
        false
      );
    }

    const { data: roleRows, error: rolesError } =
      await roleQuery;

    if (rolesError) {
      return NextResponse.json(
        { error: rolesError.message },
        { status: 500 }
      );
    }

    const eventAdmins = (roleRows ?? []).map((row: any) => {
      const user = Array.isArray(row.admin_users)
        ? row.admin_users[0]
        : row.admin_users;

      return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        isSuperAdmin: user.is_super_admin,
        isActive: user.is_active,
        roleId: row.id,
        role: row.role,
        roleIsActive: row.is_active,
        roleCreatedAt: row.created_at,
        roleUpdatedAt: row.updated_at
      };
    });

    /*
     * Super-admins may also need to manage global super-admin accounts that
     * have no explicit role for this event.
     */
    let globalSuperAdmins: any[] = [];

    if (access.admin.is_super_admin) {
      const { data, error } = await supabaseAdmin
        .from("admin_users")
        .select("id, email, full_name, is_super_admin, is_active")
        .eq("is_super_admin", true)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      globalSuperAdmins = (data ?? []).map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        isSuperAdmin: true,
        isActive: user.is_active
      }));
    }

    return NextResponse.json({
      event,
      eventAdmins,
      globalSuperAdmins,
      viewer: {
        id: access.admin.id,
        email: access.admin.email,
        isSuperAdmin: access.admin.is_super_admin
      }
    });
  } catch (error) {
    console.error("Admin-management GET error:", error);

    return NextResponse.json(
      { error: "Could not load event administrators." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const eventSlug =
      typeof body.eventSlug === "string"
        ? body.eventSlug.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    const role = body.role as EventRole | undefined;

    const requestedSuperAdmin =
      typeof body.isSuperAdmin === "boolean"
        ? body.isSuperAdmin
        : undefined;

    if (!eventSlug || !email || !fullName) {
      return NextResponse.json(
        {
          error:
            "Event, email, and full name are required."
        },
        { status: 400 }
      );
    }

    if (role !== "scanner" && role !== "manager") {
      return NextResponse.json(
        { error: "Select a valid event role." },
        { status: 400 }
      );
    }

    const event = await getEvent(eventSlug);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found." },
        { status: 404 }
      );
    }

    const access = await requireManagerForEvent(event.id);

    if (!access.allowed || !access.admin) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const actingAdmin = access.admin;

    const { data: existingAdmin, error: existingAdminError } =
      await supabaseAdmin
        .from("admin_users")
        .select(
          "id, email, full_name, is_super_admin, is_active"
        )
        .eq("email", email)
        .maybeSingle();

    if (existingAdminError) {
      return NextResponse.json(
        { error: existingAdminError.message },
        { status: 500 }
      );
    }

    // Managers can never set or unset global super-admin status.
    if (
      !actingAdmin.is_super_admin &&
      requestedSuperAdmin !== undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Only a super admin can change super-admin status."
        },
        { status: 403 }
      );
    }

    // Managers cannot modify an existing super-admin account.
    if (
      !actingAdmin.is_super_admin &&
      existingAdmin?.is_super_admin
    ) {
      return NextResponse.json(
        {
          error:
            "Event managers cannot modify a super-admin account."
        },
        { status: 403 }
      );
    }

    if (
      existingAdmin &&
      !existingAdmin.is_active &&
      !actingAdmin.is_super_admin
    ) {
      return NextResponse.json(
        {
          error:
            "This global admin account is inactive. A super admin must reactivate it."
        },
        { status: 409 }
      );
    }

    const shouldBeSuperAdmin =
      actingAdmin.is_super_admin &&
      requestedSuperAdmin !== undefined
        ? requestedSuperAdmin
        : existingAdmin?.is_super_admin ?? false;

    if (
      existingAdmin &&
      existingAdmin.email === actingAdmin.email &&
      existingAdmin.is_super_admin &&
      !shouldBeSuperAdmin
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot demote your own super-admin account."
        },
        { status: 400 }
      );
    }

    if (
      existingAdmin?.is_super_admin &&
      !shouldBeSuperAdmin
    ) {
      const { count, error } = await supabaseAdmin
        .from("admin_users")
        .select("*", { count: "exact", head: true })
        .eq("is_super_admin", true)
        .eq("is_active", true);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          {
            error:
              "You cannot remove the last active super admin."
          },
          { status: 400 }
        );
      }
    }

    let targetAdmin: {
      id: string;
      email: string;
      is_super_admin: boolean;
    };

    if (existingAdmin) {
      const update: Record<string, unknown> = {
        full_name: fullName
      };

      if (actingAdmin.is_super_admin) {
        update.is_super_admin = shouldBeSuperAdmin;
        update.is_active = true;
      }

      const { data, error } = await supabaseAdmin
        .from("admin_users")
        .update(update)
        .eq("id", existingAdmin.id)
        .select("id, email, is_super_admin")
        .single();

      if (error || !data) {
        return NextResponse.json(
          {
            error:
              error?.message ??
              "Could not update admin account."
          },
          { status: 500 }
        );
      }

      targetAdmin = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("admin_users")
        .insert({
          email,
          full_name: fullName,
          is_super_admin: actingAdmin.is_super_admin
            ? Boolean(requestedSuperAdmin)
            : false,
          is_active: true
        })
        .select("id, email, is_super_admin")
        .single();

      if (error || !data) {
        return NextResponse.json(
          {
            error:
              error?.message ??
              "Could not create admin account."
          },
          { status: 500 }
        );
      }

      targetAdmin = data;
    }

    const { data: existingRole, error: existingRoleError } =
      await supabaseAdmin
        .from("admin_event_roles")
        .select("id, role, is_active")
        .eq("admin_user_id", targetAdmin.id)
        .eq("event_id", event.id)
        .maybeSingle();

    if (existingRoleError) {
      return NextResponse.json(
        { error: existingRoleError.message },
        { status: 500 }
      );
    }

    if (
      existingRole?.is_active &&
      existingRole.role === "manager" &&
      role === "scanner"
    ) {
      const managerCount = await countActiveManagers(event.id);

      if (managerCount <= 1) {
        return NextResponse.json(
          {
            error:
              "You cannot demote the last active manager for this event. Assign another manager first."
          },
          { status: 400 }
        );
      }
    }

    /*
     * Super-admin status is global, but we still retain the selected
     * event role where supplied. This lets the account continue operating
     * normally if it is later demoted.
     */
    const now = new Date().toISOString();

    const { error: roleError } = await supabaseAdmin
      .from("admin_event_roles")
      .upsert(
        {
          admin_user_id: targetAdmin.id,
          event_id: event.id,
          role,
          is_active: true,
          invited_by_email: actingAdmin.email,
          updated_at: now,
          updated_by_email: actingAdmin.email
        },
        {
          onConflict: "admin_user_id,event_id"
        }
      );

    if (roleError) {
      return NextResponse.json(
        { error: roleError.message },
        { status: 500 }
      );
    }

    const activityAction = existingRole?.is_active
      ? existingRole.role === role
        ? "admin_updated"
        : "event_admin_role_changed"
      : "event_admin_added";

    await logAdminActivity({
      adminUserId: actingAdmin.id,
      adminEmail: actingAdmin.email,
      eventId: event.id,
      action: activityAction,
      notes: `${email} was saved as ${role} for ${event.name}.`,
      metadata: {
        targetAdminUserId: targetAdmin.id,
        targetEmail: email,
        eventSlug: event.slug,
        previousRole: existingRole?.role ?? null,
        newRole: role,
        previousSuperAdmin:
          existingAdmin?.is_super_admin ?? false,
        newSuperAdmin: targetAdmin.is_super_admin
      }
    });

    if (
      actingAdmin.is_super_admin &&
      existingAdmin &&
      existingAdmin.is_super_admin !==
        targetAdmin.is_super_admin
    ) {
      await logAdminActivity({
        adminUserId: actingAdmin.id,
        adminEmail: actingAdmin.email,
        action: "super_admin_status_changed",
        notes: `Super-admin status changed for ${email}.`,
        metadata: {
          targetAdminUserId: targetAdmin.id,
          targetEmail: email,
          previousValue: existingAdmin.is_super_admin,
          newValue: targetAdmin.is_super_admin
        }
      });
    }

    return NextResponse.json({
      message: "Administrator saved successfully."
    });
  } catch (error) {
    console.error("Admin-management POST error:", error);

    return NextResponse.json(
      { error: "Could not save administrator." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    const eventSlug =
      typeof body.eventSlug === "string"
        ? body.eventSlug.trim()
        : "";

    const adminUserId =
      typeof body.adminUserId === "string"
        ? body.adminUserId
        : "";

    if (!eventSlug || !adminUserId) {
      return NextResponse.json(
        {
          error:
            "Event slug and admin user ID are required."
        },
        { status: 400 }
      );
    }

    const event = await getEvent(eventSlug);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found." },
        { status: 404 }
      );
    }

    const access = await requireManagerForEvent(event.id);

    if (!access.allowed || !access.admin) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const actingAdmin = access.admin;

    const { data: targetAdmin, error: targetAdminError } =
      await supabaseAdmin
        .from("admin_users")
        .select("id, email, is_super_admin")
        .eq("id", adminUserId)
        .single();

    if (targetAdminError || !targetAdmin) {
      return NextResponse.json(
        { error: "Administrator not found." },
        { status: 404 }
      );
    }

    if (
      !actingAdmin.is_super_admin &&
      targetAdmin.is_super_admin
    ) {
      return NextResponse.json(
        {
          error:
            "Event managers cannot modify a super-admin account."
        },
        { status: 403 }
      );
    }

    const { data: targetRole, error: targetRoleError } =
      await supabaseAdmin
        .from("admin_event_roles")
        .select("id, role, is_active")
        .eq("admin_user_id", targetAdmin.id)
        .eq("event_id", event.id)
        .eq("is_active", true)
        .maybeSingle();

    if (targetRoleError) {
      return NextResponse.json(
        { error: targetRoleError.message },
        { status: 500 }
      );
    }

    if (!targetRole) {
      return NextResponse.json(
        {
          error:
            "This administrator does not have active access to the selected event."
        },
        { status: 404 }
      );
    }

    if (targetRole.role === "manager") {
      const managerCount = await countActiveManagers(event.id);

      if (managerCount <= 1) {
        return NextResponse.json(
          {
            error:
              "You cannot remove the last active manager for this event."
          },
          { status: 400 }
        );
      }
    }

    const { error: removalError } = await supabaseAdmin
      .from("admin_event_roles")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
        updated_by_email: actingAdmin.email
      })
      .eq("id", targetRole.id)
      .eq("event_id", event.id);

    if (removalError) {
      return NextResponse.json(
        { error: removalError.message },
        { status: 500 }
      );
    }

    await logAdminActivity({
      adminUserId: actingAdmin.id,
      adminEmail: actingAdmin.email,
      eventId: event.id,
      action: "event_admin_removed",
      notes: `${targetAdmin.email} was removed from ${event.name}.`,
      metadata: {
        targetAdminUserId: targetAdmin.id,
        targetEmail: targetAdmin.email,
        eventSlug: event.slug,
        previousRole: targetRole.role
      }
    });

    return NextResponse.json({
      message: "Event access removed successfully."
    });
  } catch (error) {
    console.error("Admin-management DELETE error:", error);

    return NextResponse.json(
      { error: "Could not remove event access." },
      { status: 500 }
    );
  }
}