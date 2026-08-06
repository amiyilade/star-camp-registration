import { AdminOrdersClient } from "@/components/AdminOrdersClient";
import { AdminShell } from "@/components/AdminShell";

export default function AdminOrdersPage() {
  return (
    <AdminShell>
      <AdminOrdersClient />
    </AdminShell>
  );
}