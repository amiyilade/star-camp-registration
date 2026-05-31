import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/auth/get-admin-user";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AdminCreateForm } from "@/components/AdminCreateForm";
import { AdminEditCard } from "@/components/AdminEditCard";

export default async function AdminManagePage() {
  const admin = await getAdminUser();

  if (!admin) {
    redirect("/admin/login");
  }

  if (!admin.is_super_admin) {
    redirect("/admin/scan");
  }

  const { data: admins, error } = await supabaseAdmin
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
    throw new Error(error.message);
  }

  return (
    <main className="min-h-screen bg-lavender px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold text-royalDark">
            Admin Management
          </h1>

          <p className="mt-2 text-muted">
            Manage STAR Camp event access.
          </p>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-purple-100 bg-white shadow-soft">
        <AdminCreateForm />
        <div className="space-y-4">
            {admins?.map((item: any) => (
                <AdminEditCard key={item.id} admin={item} />
            ))}
        </div>
        </div>
      </div>
    </main>
  );
}