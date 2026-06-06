"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [admin, setAdmin] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdmin() {
      try {
        const response = await fetch("/api/admin/me");
        const result = await response.json();

        if (response.ok) {
          setAdmin(result.admin);
        }
      } finally {
        setLoading(false);
      }
    }

    loadAdmin();
  }, []);

  const isSuperAdmin = admin?.is_super_admin;

  const navItems = [
    ...(isSuperAdmin
      ? [{ href: "/admin/dashboard", label: "Dashboard" }]
      : []),

    { href: "/admin/scan", label: "Scanner" },
    { href: "/admin/badge-queue", label: "Badge Queue" },

    ...(isSuperAdmin
      ? [{ href: "/admin/manage", label: "Manage Admins" }]
      : [])
  ];

  return (
    <main className="min-h-screen bg-lavender">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-64">
          <div className="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-royal">
              STAR Camp
            </p>

            <h1 className="mt-2 text-2xl font-black text-royalDark">
              Admin
            </h1>

            {loading ? (
              <p className="mt-6 text-sm text-muted">Loading...</p>
            ) : (
              <nav className="mt-6 space-y-2">
                {navItems.map((item) => {
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        active
                          ? "bg-royal text-white"
                          : "text-royal hover:bg-lavender"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}