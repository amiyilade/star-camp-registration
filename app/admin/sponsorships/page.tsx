import {
  AdminSponsorshipsClient
} from "@/components/AdminSponsorshipsClient";

import {
  AdminShell
} from "@/components/AdminShell";

export default function AdminSponsorshipsPage() {
  return (
    <AdminShell>
      <AdminSponsorshipsClient />
    </AdminShell>
  );
}