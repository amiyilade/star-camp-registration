"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function AdminScanPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [lookupValue, setLookupValue] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<any | null>(null);
  const [scannerActive, setScannerActive] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user?.email) {
        window.location.href = "/admin/login";
        return;
      }

      setEmail(user.email);
      setLoading(false);
    }

    loadUser();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  }

  async function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = lookupValue.trim();

    if (!value) return;

    try {
      setLookupLoading(true);
      setLookupError(null);
      setTicket(null);

      const isTicketCode = value.toUpperCase().startsWith("SC-");

      const url = isTicketCode
        ? `/api/admin/tickets/verify?ticketCode=${encodeURIComponent(value)}`
        : `/api/admin/tickets/verify?token=${encodeURIComponent(value)}`;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        setLookupError(result.error ?? "Could not verify ticket.");
        return;
      }

      setTicket(result.ticket);
    } catch {
      setLookupError("Something went wrong while verifying the ticket.");
    } finally {
      setLookupLoading(false);
    }
  }

  function extractTokenFromScan(scannedText: string) {
  try {
    const url = new URL(scannedText);
    const parts = url.pathname.split("/");
    return parts[parts.length - 1];
  } catch {
    return scannedText;
  }
}

  useEffect(() => {
  if (!scannerActive) return;

  const scanner = new Html5QrcodeScanner(
    "qr-reader",
    {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    },
    false
  );

  scanner.render(
    async (decodedText) => {
      const token = extractTokenFromScan(decodedText);

      setLookupValue(token);
      setScannerActive(false);

      await scanner.clear();

      const response = await fetch(
        `/api/admin/tickets/verify?token=${encodeURIComponent(token)}`
      );

      const result = await response.json();

      if (!response.ok) {
        setLookupError(result.error ?? "Could not verify ticket.");
        return;
      }

      setLookupError(null);
      setTicket(result.ticket);
    },
    (errorMessage) => {
      // Ignore repeated scan-frame errors
      console.debug(errorMessage);
    }
  );

  return () => {
    scanner.clear().catch(() => {});
  };
}, [scannerActive]);

  if (loading) {
    return (
      <main className="min-h-screen bg-lavender px-6 py-16">
        <p className="text-center text-muted">Loading admin scanner...</p>
      </main>
    );
  }

  async function handleTicketAction(action: "check-in" | "check-out") {
    if (!ticket?.id) return;

    try {
        setLookupLoading(true);
        setLookupError(null);

        const response = await fetch(`/api/admin/tickets/${action}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            ticketId: ticket.id
        })
        });

        const result = await response.json();

        if (!response.ok) {
        setLookupError(result.error ?? "Action failed.");
        return;
        }

        setTicket((current: any) => ({
        ...current,
        teams: result.ticket.teams ?? current.teams,
        checked_in_at: result.ticket.checked_in_at,
        checked_out_at: result.ticket.checked_out_at
        }));
    } catch {
        setLookupError("Something went wrong.");
    } finally {
        setLookupLoading(false);
    }
    }


  const attendee = Array.isArray(ticket?.attendees)
    ? ticket?.attendees[0]
    : ticket?.attendees;

  const event = Array.isArray(ticket?.events)
    ? ticket?.events[0]
    : ticket?.events;

  return (
    <main className="min-h-screen bg-lavender px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
              STAR Camp Admin
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-royalDark">
              Ticket Scanner
            </h1>

            <p className="mt-2 text-muted">Logged in as {email}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-purple-200 px-5 py-3 text-sm font-semibold text-royal hover:bg-white"
          >
            Log out
          </button>
        </div>

        <form
          onSubmit={handleLookup}
          className="mt-10 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft"
        >
          <h2 className="text-2xl font-semibold text-royalDark">
            Verify ticket
          </h2>

          <p className="mt-2 text-muted">
            Paste a QR token or ticket code. Camera scanning comes next.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <input
              value={lookupValue}
              onChange={(event) => setLookupValue(event.target.value)}
              placeholder="SC-ABJ-XXXXXXXX or QR token"
              className="min-w-0 flex-1 rounded-2xl border border-purple-100 px-4 py-3 outline-none focus:border-royal"
            />

            <button
              type="submit"
              disabled={lookupLoading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white shadow-soft hover:bg-royalDark disabled:opacity-60"
            >
              <Search size={16} />
              {lookupLoading ? "Checking..." : "Verify"}
            </button>
          </div>

          {lookupError && (
            <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {lookupError}
            </p>
          )}
        </form>

        <div className="mt-6 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between gap-4">
            <div>
            <h2 className="text-2xl font-semibold text-royalDark">
                Camera scanner
            </h2>

            <p className="mt-2 text-muted">
                Use your phone camera to scan a ticket QR code.
            </p>
            </div>

            <button
            type="button"
            onClick={() => setScannerActive((current) => !current)}
            className="rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white hover:bg-royalDark"
            >
            {scannerActive ? "Stop scanner" : "Start scanner"}
            </button>
        </div>

        {scannerActive && (
            <div
            id="qr-reader"
            className="mt-6 overflow-hidden rounded-3xl border border-purple-100"
            />
        )}
        </div>

        {ticket && (
          <section className="mt-8 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-4 md:flex-row">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-royal">
                  Ticket found
                </p>

                <h2 className="mt-3 text-3xl font-semibold text-royalDark">
                  {attendee?.first_name} {attendee?.last_name}
                </h2>

                <p className="mt-2 text-muted">
                  {event?.name} · {event?.location}
                </p>
              </div>

              <div className="rounded-2xl bg-lavender px-5 py-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Status
                </p>
                <p className="mt-1 text-xl font-bold text-royalDark">
                  {ticket.status}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Info label="Assigned Team" value={ticket?.teams?.name ? `${ticket.teams.name} (${ticket.teams.code})` : "Not assigned yet"}/>
              <Info label="Ticket Code" value={ticket.ticket_code} />
              <Info label="Department" value={attendee?.department} />
              <Info label="Age" value={attendee?.age_at_registration != null ? String(attendee.age_at_registration) : "—"}/>
              <Info label="Gender" value={attendee?.gender} />
              <Info
                label="Phone"
                value={`${attendee?.phone_country_code ?? ""} ${
                  attendee?.phone_number ?? ""
                }`}
              />
              <Info
                label="Guardian/Emergency"
                value={
                  attendee?.guardian_name
                    ? `${attendee.guardian_name} · ${attendee.guardian_phone_country_code ?? ""} ${attendee.guardian_phone_number ?? ""}`
                    : attendee?.emergency_contact_name
                      ? `${attendee.emergency_contact_name} · ${attendee.emergency_contact_phone_country_code ?? ""} ${attendee.emergency_contact_phone_number ?? ""}`
                      : "Not provided"
                }
              />
            </div>

            {ticket.checked_in_at && (
              <p className="mt-5 rounded-2xl bg-green-50 p-4 text-sm text-green-700">
                Checked in at {ticket.checked_in_at}
              </p>
            )}

            {ticket.checked_out_at && (
              <p className="mt-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-700">
                Checked out at {ticket.checked_out_at}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {(() => {
                const isCurrentlyCheckedIn =
                ticket.checked_in_at &&
                (!ticket.checked_out_at ||
                    new Date(ticket.checked_in_at) > new Date(ticket.checked_out_at));

                return (
                <>
                    {!isCurrentlyCheckedIn && (
                    <button
                        type="button"
                        onClick={() => handleTicketAction("check-in")}
                        disabled={lookupLoading}
                        className="rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                        Check In
                    </button>
                    )}

                    {isCurrentlyCheckedIn && (
                    <button
                        type="button"
                        onClick={() => handleTicketAction("check-out")}
                        disabled={lookupLoading}
                        className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                        Check Out
                    </button>
                    )}
                </>
                );
            })()}
            </div>
          </section>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm font-semibold text-royal hover:underline"
          >
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}

function Info({
  label,
  value
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-purple-100 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </p>
      <p className="mt-2 font-semibold text-royalDark">
        {value || "—"}
      </p>
    </div>
  );
}