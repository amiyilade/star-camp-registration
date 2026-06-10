"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [admin, setAdmin] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("adminNavCollapsed");
    setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("adminNavCollapsed", String(collapsed));
  }, [collapsed]);

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
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row">
        <aside
          className={`transition-all lg:sticky lg:top-4 lg:self-start ${
            collapsed ? "lg:w-14" : "lg:w-64"
          }`}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-white text-xl font-black text-royal shadow-soft hover:bg-lavender"
              aria-label="Expand navigation"
              title="Expand navigation"
            >
              ☰
            </button>
          ) : (
            <div className="rounded-[2rem] border border-purple-100 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-royal">
                    STAR Camp
                  </p>

                  <h1 className="mt-1 text-2xl font-black text-royalDark">
                    Admin
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="rounded-full border border-purple-200 px-3 py-2 text-sm font-semibold text-royal hover:bg-lavender"
                  aria-label="Collapse navigation"
                  title="Collapse navigation"
                >
                  ←
                </button>
              </div>

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
          )}
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}