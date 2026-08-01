"use client";

import { useEffect, useState } from "react";

type ManagedEvent = {
  id: string;
  name: string;
  slug: string;
  location: string;
};

type EventAdmin = {
  id: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  roleId?: string;
  role?: "scanner" | "manager";
};

export function AdminManagementClient({
  events,
  viewerIsSuperAdmin
}: {
  events: ManagedEvent[];
  viewerIsSuperAdmin: boolean;
}) {
  const [eventSlug, setEventSlug] = useState(
    events[0]?.slug ?? ""
  );

  const [admins, setAdmins] = useState<EventAdmin[]>([]);
  const [globalSuperAdmins, setGlobalSuperAdmins] =
    useState<EventAdmin[]>([]);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] =
    useState<"scanner" | "manager">("scanner");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(
    null
  );
  const [status, setStatus] = useState<string | null>(null);

  async function loadAdmins() {
    if (!eventSlug) return;

    try {
      setLoading(true);
      setPageError(null);

      const response = await fetch(
        `/api/admin/manage?eventSlug=${encodeURIComponent(
          eventSlug
        )}`
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/admin/login";
          return;
        }

        if (response.status === 403) {
          window.location.href = "/admin/scan";
          return;
        }

        setPageError(
          result.error ?? "Could not load administrators."
        );
        return;
      }

      setAdmins(result.eventAdmins ?? []);
      setGlobalSuperAdmins(result.globalSuperAdmins ?? []);
    } catch {
      setPageError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
  }, [eventSlug]);

  async function saveAdmin(
    values?: Partial<{
      email: string;
      fullName: string;
      role: "scanner" | "manager";
      isSuperAdmin: boolean;
    }>
  ) {
    try {
      setLoading(true);
      setStatus(null);

      const payload: Record<string, unknown> = {
        eventSlug,
        email: values?.email ?? email,
        fullName: values?.fullName ?? fullName,
        role: values?.role ?? role
      };

      if (viewerIsSuperAdmin) {
        payload.isSuperAdmin =
          values?.isSuperAdmin ?? isSuperAdmin;
      }

      const response = await fetch("/api/admin/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus(
          result.error ?? "Could not save administrator."
        );
        return false;
      }

      setStatus("Administrator saved successfully.");
      setEmail("");
      setFullName("");
      setRole("scanner");
      setIsSuperAdmin(false);

      await loadAdmins();

      return true;
    } catch {
      setStatus("Something went wrong.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function removeEventAccess(adminUserId: string) {
    const confirmed = window.confirm(
      "Remove this administrator's access to the selected event?"
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      setStatus(null);

      const response = await fetch("/api/admin/manage", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          eventSlug,
          adminUserId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus(
          result.error ?? "Could not remove event access."
        );
        return;
      }

      setStatus("Event access removed.");
      await loadAdmins();
    } catch {
      setStatus("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (events.length === 0) {
    return (
      <p className="rounded-2xl bg-red-50 p-4 font-semibold text-red-700">
        You do not manage any active events.
      </p>
    );
  }

  return (
    <div>
      <section className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
        <label className="block">
          <span className="text-sm font-semibold text-royalDark">
            Event to manage
          </span>

          <select
            value={eventSlug}
            onChange={(event) =>
              setEventSlug(event.target.value)
            }
            className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3 md:max-w-md"
          >
            {events.map((event) => (
              <option key={event.id} value={event.slug}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          saveAdmin();
        }}
        className="mt-6 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft"
      >
        <h2 className="text-2xl font-semibold text-royalDark">
          Add administrator
        </h2>

        <p className="mt-2 text-sm text-muted">
          Access will apply only to the selected event.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            type="email"
            required
            placeholder="Admin email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            className="rounded-2xl border border-purple-100 px-4 py-3"
          />

          <input
            required
            placeholder="Full name"
            value={fullName}
            onChange={(event) =>
              setFullName(event.target.value)
            }
            className="rounded-2xl border border-purple-100 px-4 py-3"
          />

          <select
            value={role}
            onChange={(event) =>
              setRole(
                event.target.value as "scanner" | "manager"
              )
            }
            className="rounded-2xl border border-purple-100 px-4 py-3"
          >
            <option value="scanner">Scanner</option>
            <option value="manager">Manager</option>
          </select>

          {viewerIsSuperAdmin && (
            <label className="flex items-center gap-3 rounded-2xl border border-purple-100 px-4 py-3">
              <input
                type="checkbox"
                checked={isSuperAdmin}
                onChange={(event) =>
                  setIsSuperAdmin(event.target.checked)
                }
              />
              Global super admin
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save administrator"}
        </button>
      </form>

      {status && (
        <p className="mt-6 rounded-2xl bg-lavender p-4 text-sm font-semibold text-royalDark">
          {status}
        </p>
      )}

      {pageError && (
        <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          {pageError}
        </p>
      )}

      <section className="mt-8 space-y-4">
        <h2 className="text-2xl font-semibold text-royalDark">
          Event administrators
        </h2>

        {admins.map((admin) => (
          <EventAdminCard
            key={admin.id}
            admin={admin}
            viewerIsSuperAdmin={viewerIsSuperAdmin}
            loading={loading}
            onSave={saveAdmin}
            onRemove={() => removeEventAccess(admin.id)}
          />
        ))}

        {!loading && admins.length === 0 && (
          <div className="rounded-[2rem] border border-purple-100 bg-white p-8 text-center shadow-soft">
            <p className="text-muted">
              No administrators are assigned to this event.
            </p>
          </div>
        )}
      </section>

      {viewerIsSuperAdmin &&
        globalSuperAdmins.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-royalDark">
              Global super admins
            </h2>

            <p className="mt-2 text-sm text-muted">
              Super-admin status applies across all events.
            </p>

            <div className="mt-4 space-y-3">
              {globalSuperAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-soft"
                >
                  <p className="font-semibold text-royalDark">
                    {admin.fullName}
                  </p>

                  <p className="mt-1 text-sm text-muted">
                    {admin.email}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
    </div>
  );
}

function EventAdminCard({
  admin,
  viewerIsSuperAdmin,
  loading,
  onSave,
  onRemove
}: {
  admin: EventAdmin;
  viewerIsSuperAdmin: boolean;
  loading: boolean;
  onSave: (
    values: Partial<{
      email: string;
      fullName: string;
      role: "scanner" | "manager";
      isSuperAdmin: boolean;
    }>
  ) => Promise<boolean>;
  onRemove: () => void;
}) {
  const [fullName, setFullName] = useState(admin.fullName);
  const [role, setRole] = useState<"scanner" | "manager">(
    admin.role ?? "scanner"
  );
  const [isSuperAdmin, setIsSuperAdmin] = useState(
    admin.isSuperAdmin
  );

  return (
    <div className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
      <p className="font-semibold text-royalDark">
        {admin.email}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <input
          value={fullName}
          onChange={(event) =>
            setFullName(event.target.value)
          }
          className="rounded-2xl border border-purple-100 px-4 py-3"
        />

        <select
          value={role}
          onChange={(event) =>
            setRole(
              event.target.value as "scanner" | "manager"
            )
          }
          className="rounded-2xl border border-purple-100 px-4 py-3"
        >
          <option value="scanner">Scanner</option>
          <option value="manager">Manager</option>
        </select>

        {viewerIsSuperAdmin && (
          <label className="flex items-center gap-3 rounded-2xl border border-purple-100 px-4 py-3">
            <input
              type="checkbox"
              checked={isSuperAdmin}
              onChange={(event) =>
                setIsSuperAdmin(event.target.checked)
              }
            />
            Super admin
          </label>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() =>
            onSave({
              email: admin.email,
              fullName,
              role,
              ...(viewerIsSuperAdmin
                ? { isSuperAdmin }
                : {})
            })
          }
          className="rounded-full bg-royal px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save changes
        </button>

        {!admin.isSuperAdmin && (
          <button
            type="button"
            disabled={loading}
            onClick={onRemove}
            className="rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
          >
            Remove event access
          </button>
        )}
      </div>
    </div>
  );
}