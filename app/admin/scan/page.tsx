"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { createClient } from "@/lib/supabase/client";


type ScannerAction = "check-in" | "check-out";
type WorkflowMode = "solo" | "badge-queue";

export default function AdminScanPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [scannerAction, setScannerAction] = useState<ScannerAction>("check-in");
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("solo");

  const [scannerRunning, setScannerRunning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lookupValue, setLookupValue] = useState("");
  const [ticket, setTicket] = useState<any | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const qrRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ token: string; time: number } | null>(null);

  const [resultHoldSeconds, setResultHoldSeconds] = useState<number | "manual">("manual");
  const resultTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedAction = localStorage.getItem("scannerAction") as ScannerAction | null;
    const savedWorkflow = localStorage.getItem("workflowMode") as WorkflowMode | null;

    if (savedAction) setScannerAction(savedAction);
    if (savedWorkflow) setWorkflowMode(savedWorkflow);
  }, []);

  useEffect(() => {
    localStorage.setItem("scannerAction", scannerAction);
  }, [scannerAction]);

  useEffect(() => {
    localStorage.setItem("workflowMode", workflowMode);
  }, [workflowMode]);

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

  function extractTokenFromScan(scannedText: string) {
    try {
      const url = new URL(scannedText);
      const parts = url.pathname.split("/");
      return parts[parts.length - 1];
    } catch {
      return scannedText;
    }
  }

  async function verifyTicket(tokenOrCode: string) {
    const value = tokenOrCode.trim();
    const isTicketCode = value.toUpperCase().startsWith("SC-");

    const url = isTicketCode
      ? `/api/admin/tickets/verify?ticketCode=${encodeURIComponent(value)}`
      : `/api/admin/tickets/verify?token=${encodeURIComponent(value)}`;

    const response = await fetch(url);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Could not verify ticket.");
    }

    return result.ticket;
  }

  async function performTicketAction(ticketId: string, action: "check-in" | "check-out") {
    const response = await fetch(`/api/admin/tickets/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ticketId })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Action failed.");
    }

    return result;
  }

  async function processScannedTicket(scannedText: string) {
    if (processing) return;

    const token = extractTokenFromScan(scannedText);
    const now = Date.now();

    if (
      lastScanRef.current?.token === token &&
      now - lastScanRef.current.time < 3000
    ) {
      return;
    }

    lastScanRef.current = { token, time: now };

    try {
      setProcessing(true);
      setLookupError(null);
      setTicket(null);
      setResultMessage(null);

      qrRef.current?.pause(true);

      const verifiedTicket = await verifyTicket(token);

      const updatedTicket = await performTicketAction(
        verifiedTicket.id,
        scannerAction
      );

      setTicket({
        ...verifiedTicket,
        checked_in_at: updatedTicket.ticket.checked_in_at,
        checked_out_at: updatedTicket.ticket.checked_out_at,
        teams: updatedTicket.ticket.teams ?? verifiedTicket.teams
      });

      setResultMessage(
        updatedTicket.alreadyCheckedIn
          ? "Already checked in."
          : scannerAction === "check-in"
            ? workflowMode === "badge-queue"
              ? "Checked in. Send to badge desk."
              : "Checked in. Write badge, then tap to continue."
            : "Checked out."
      );

      if (resultHoldSeconds !== "manual") {
        resultTimerRef.current = setTimeout(() => {
          continueScanning();
        }, resultHoldSeconds * 1000);
      }
    } catch (error) {
      setLookupError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function startScanner() {
    if (qrRef.current) return;

    const qr = new Html5Qrcode("qr-reader");
    qrRef.current = qr;

    await qr.start(
      { facingMode: "environment" },
      {
        fps: 12,
        qrbox: { width: 260, height: 260 }
      },
      processScannedTicket,
      () => {}
    );

    setScannerRunning(true);
  }

  async function stopScanner() {
    if (!qrRef.current) return;

    await qrRef.current.stop();
    await qrRef.current.clear();

    qrRef.current = null;
    setScannerRunning(false);
  }

  function continueScanning() {
    setTicket(null);
    setResultMessage(null);
    setLookupError(null);
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }

    try {
      qrRef.current?.resume();
    } catch {
      // ignore resume failures
    }
  }

  async function handleManualLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setProcessing(true);
      setLookupError(null);
      setTicket(null);

      const verifiedTicket = await verifyTicket(lookupValue);
      setTicket(verifiedTicket);
      setResultMessage("Ticket verified.");
    } catch (error) {
      setLookupError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-lavender px-6 py-16">
        <p className="text-center text-muted">Loading scanner...</p>
      </main>
    );
  }

  const attendee = Array.isArray(ticket?.attendees)
    ? ticket?.attendees[0]
    : ticket?.attendees;

  const event = Array.isArray(ticket?.events)
    ? ticket?.events[0]
    : ticket?.events;

  const team = Array.isArray(ticket?.teams)
    ? ticket?.teams[0]
    : ticket?.teams;

  return (
    <main className="min-h-screen bg-lavender px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
              STAR Camp Admin
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-royalDark">
              Scanner
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

        <details className="mb-4 rounded-2xl border border-purple-100 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-royal">
            Scanner settings
          </summary>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <select
              value={scannerAction}
              onChange={(event) =>
                setScannerAction(event.target.value as ScannerAction)
              }
              className="rounded-2xl border border-purple-100 px-4 py-3"
            >
              <option value="check-in">Check-in</option>
              <option value="check-out">Check-out</option>
            </select>

            <select
              value={workflowMode}
              onChange={(event) =>
                setWorkflowMode(event.target.value as WorkflowMode)
              }
              className="rounded-2xl border border-purple-100 px-4 py-3"
            >
              <option value="solo">Solo volunteer</option>
              <option value="badge-queue">Badge queue</option>
            </select>

            <select
              value={resultHoldSeconds}
              onChange={(event) => {
                const value = event.target.value;
                setResultHoldSeconds(value === "manual" ? "manual" : Number(value));
              }}
              className="rounded-2xl border border-purple-100 px-4 py-3"
            >
              <option value="manual">Tap to continue</option>
              <option value="5">Auto continue: 5s</option>
              <option value="10">Auto continue: 10s</option>
              <option value="15">Auto continue: 15s</option>
              <option value="30">Auto continue: 30s</option>
              <option value="60">Auto continue: 60s</option>
              <option value="120">Auto continue: 120s</option>
            </select>
          </div>
      </details>

        <section className="mt-4 rounded-[2rem] border border-purple-100 bg-white p-4 shadow-soft">
          <div className="flex gap-3">
            {!scannerRunning ? (
              <button
                type="button"
                onClick={startScanner}
                className="rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white"
              >
                Start scanner
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScanner}
                className="rounded-full border border-purple-200 px-6 py-3 text-sm font-semibold text-royal"
              >
                Stop scanner
              </button>
            )}
          </div>

          <div
            id="qr-reader"
            className="mt-4 overflow-hidden rounded-3xl border border-purple-100"
          />
      </section>

        {ticket && (
        <button
          type="button"
          onClick={continueScanning}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 text-left"
        >
          <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 text-center shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
              {resultMessage}
            </p>

            <h2 className="mt-4 text-4xl font-black text-royalDark">
              {attendee?.first_name} {attendee?.last_name}
            </h2>

            <div className="mt-6 rounded-[2rem] bg-lavender p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted">
                Team
              </p>

              <p className="mt-2 text-5xl font-black text-royal">
                {team?.name ?? "Not assigned"}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-purple-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Department
                </p>
                <p className="mt-2 text-lg font-bold text-royalDark">
                  {attendee?.department ?? "—"}
                </p>
              </div>

              <div className="rounded-2xl border border-purple-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Age Group
                </p>
                <p className="mt-2 text-lg font-bold text-royalDark">
                  {attendee?.age_at_registration < 20 ? "Under 20" : "20 or older"}
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm font-semibold text-muted">
              {resultHoldSeconds === "manual"
                ? "Tap anywhere to continue scanning."
                : `Auto-continues in ${resultHoldSeconds} seconds. Tap to continue now.`}
            </p>
          </div>
        </button>
      )}

        <form
          onSubmit={handleManualLookup}
          className="mt-6 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft"
        >
          <h2 className="text-xl font-semibold text-royalDark">
            Manual lookup
          </h2>

          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              value={lookupValue}
              onChange={(event) => setLookupValue(event.target.value)}
              placeholder="Ticket code or QR token"
              className="min-w-0 flex-1 rounded-2xl border border-purple-100 px-4 py-3"
            />

            <button
              type="submit"
              disabled={processing}
              className="rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {processing ? "Checking..." : "Verify"}
            </button>
          </div>
        </form>

        {lookupError && (
          <button
            type="button"
            onClick={continueScanning}
            className="mt-6 w-full rounded-[2rem] border border-red-100 bg-red-50 p-8 text-left shadow-soft"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-700">
              Error
            </p>

            <p className="mt-3 text-2xl font-semibold text-red-800">
              {lookupError}
            </p>

            <p className="mt-4 text-sm text-red-700">
              Tap to continue scanning.
            </p>
          </button>
        )}

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
      <p className="mt-2 font-semibold text-royalDark">{value || "—"}</p>
    </div>
  );
}