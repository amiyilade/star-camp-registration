import { redirect } from "next/navigation";

import { AdminShell } from "@/components/AdminShell";
import { AdminManagementClient } from "@/components/AdminManagementClient";
import { getManagedEvents } from "@/lib/auth/get-managed-events";

export default async function AdminManagePage() {
  const { admin, events } = await getManagedEvents();

  if (!admin) {
    redirect("/admin/login");
  }

  if (!admin.is_super_admin && events.length === 0) {
    redirect("/admin/scan");
  }

  return (
    <AdminShell>
      <div>
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
            STAR Camp Admin
          </p>

          <h1 className="mt-2 text-4xl font-semibold text-royalDark">
            Admin Management
          </h1>

          <p className="mt-2 text-muted">
            Manage scanner and manager access by event.
          </p>
        </div>

        <AdminManagementClient
          events={events as any}
          viewerIsSuperAdmin={admin.is_super_admin}
        />
      </div>
    </AdminShell>
  );
}