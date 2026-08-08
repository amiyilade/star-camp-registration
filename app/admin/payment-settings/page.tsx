import {
  AdminPaymentSettingsClient
} from "@/components/AdminPaymentSettingsClient";

import {
  AdminShell
} from "@/components/AdminShell";

export default function AdminPaymentSettingsPage() {
  return (
    <AdminShell>
      <AdminPaymentSettingsClient />
    </AdminShell>
  );
}