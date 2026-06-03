"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/scan", label: "Scanner" },
  { href: "/admin/badge-queue", label: "Badge Queue" },
  { href: "/admin/manage", label: "Manage Admins" }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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

            <nav className="mt-6 space-y-2">
              {NAV_ITEMS.map((item) => {
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
          </div>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}