"use client";

import { useEffect, useState } from "react";

type EventOption = {
  id: string;
  name: string;
  slug: string;
  location: string | null;
};

type OrderRow = {
  id: string;
  eventId: string;
  publicReference: string | null;

  buyerFullName: string;
  buyerEmail: string;
  buyerPhone: string;

  ticketQuantity: number;
  unitPriceNgn: number;
  totalAmountNgn: number;

  status: string;
  paystackReference: string | null;
  paidAt: string | null;
  createdAt: string;

  event: EventOption | null;

  attendees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  }>;

  fulfillment: {
    state:
      | "not_applicable"
      | "complete"
      | "missing_tickets"
      | "emails_pending"
      | "missing_tickets_and_emails_pending"
      | "invalid_tickets";

    attendeeCount: number;
    totalTicketCount: number;
    validTicketCount: number;
    invalidTicketCount: number;
    missingTicketCount: number;
    unsentEmailCount: number;
    claimedEmailCount: number;
  };
};

type RepairResult = {
  orderId: string;
  ticketsCreated: number;
  validTicketCount: number;
  email: {
    sent: number;
    alreadySent: number;
    claimedElsewhere: number;
    failures: Array<{
      ticketId: string;
      attendeeId: string;
      message: string;
    }>;
  };
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function fulfillmentLabel(
  state: OrderRow["fulfillment"]["state"]
) {
  switch (state) {
    case "complete":
      return "Complete";

    case "missing_tickets":
      return "Missing tickets";

    case "emails_pending":
      return "Emails pending";

    case "missing_tickets_and_emails_pending":
      return "Missing tickets and emails pending";

    case "invalid_tickets":
      return "Invalid ticket requires review";

    default:
      return "Not applicable";
  }
}

function fulfillmentClass(
  state: OrderRow["fulfillment"]["state"]
) {
  switch (state) {
    case "complete":
      return "border-green-200 bg-green-50 text-green-800";

    case "not_applicable":
      return "border-slate-200 bg-slate-50 text-slate-700";

    case "invalid_tickets":
      return "border-red-200 bg-red-50 text-red-800";

    default:
      return "border-amber-200 bg-amber-50 text-amber-800";
  }
}

export function AdminOrdersClient() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);

  const [eventSlug, setEventSlug] = useState("all");
  const [status, setStatus] = useState("all");
  const [issue, setIssue] = useState("all");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const [repairingOrderId, setRepairingOrderId] =
    useState<string | null>(null);

  const [repairResults, setRepairResults] =
    useState<Record<string, RepairResult>>({});

  async function loadOrders() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        eventSlug,
        status,
        issue,
        page: String(page)
      });

      if (search.trim().length >= 2) {
        params.set("search", search.trim());
      }

      const response = await fetch(
        `/api/admin/orders?${params.toString()}`,
        {
          cache: "no-store"
        }
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

        setError(
          result.error ??
            "Could not load registration orders."
        );

        return;
      }

      setOrders(result.orders ?? []);
      setEvents(result.events ?? []);

      setTotal(
        result.pagination?.total ?? 0
      );

      setTotalPages(
        result.pagination?.totalPages ?? 1
      );
    } catch {
      setError(
        "Something went wrong while loading registration orders."
      );
    } finally {
      setLoading(false);
    }
  }

  async function repairFulfillment(
    orderId: string
  ) {
    try {
      setRepairingOrderId(orderId);
      setError(null);

      const response = await fetch(
        `/api/admin/orders/${orderId}/repair-fulfillment`,
        {
          method: "POST"
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ??
            "Could not repair order fulfillment."
        );

        return;
      }

      setRepairResults((current) => ({
        ...current,
        [orderId]: result.fulfillment
      }));

      await loadOrders();
    } catch {
      setError(
        "Something went wrong while repairing fulfillment."
      );
    } finally {
      setRepairingOrderId(null);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadOrders();
    }, search.length > 0 ? 350 : 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    eventSlug,
    status,
    issue,
    search,
    page
  ]);

  function resetPage() {
    setPage(1);
  }

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
        STAR Camp Admin
      </p>

      <h1 className="mt-2 text-4xl font-semibold text-royalDark">
        Registration Orders
      </h1>

      <p className="mt-2 text-muted">
        Review payments, attendee totals, ticket generation, and ticket-email
        delivery.
      </p>

      <section className="mt-8 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            placeholder="Reference, buyer, email, phone..."
            className="rounded-2xl border border-purple-100 px-4 py-3 outline-none focus:border-royal"
          />

          <select
            value={eventSlug}
            onChange={(event) => {
              setEventSlug(event.target.value);
              resetPage();
            }}
            className="rounded-2xl border border-purple-100 px-4 py-3"
          >
            <option value="all">
              All accessible events
            </option>

            {events.map((event) => (
              <option
                key={event.id}
                value={event.slug}
              >
                {event.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              resetPage();
            }}
            className="rounded-2xl border border-purple-100 px-4 py-3"
          >
            <option value="all">
              All payment statuses
            </option>
            <option value="paid">Paid</option>
            <option value="pending_payment">
              Pending payment
            </option>
            <option value="draft">Draft</option>
            <option value="expired">
              Expired
            </option>
            <option value="cancelled">
              Cancelled
            </option>
          </select>

          <select
            value={issue}
            onChange={(event) => {
              setIssue(event.target.value);
              resetPage();
            }}
            className="rounded-2xl border border-purple-100 px-4 py-3"
          >
            <option value="all">
              All fulfillment states
            </option>
            <option value="needs_attention">
              Needs attention
            </option>
            <option value="missing_tickets">
              Missing tickets
            </option>
            <option value="emails_pending">
              Emails pending
            </option>
            <option value="invalid_tickets">
              Invalid tickets
            </option>
          </select>
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-muted">
          {total} order{total === 1 ? "" : "s"}
        </p>

        {loading && (
          <p className="text-sm text-muted">
            Loading orders...
          </p>
        )}
      </div>

      <section className="mt-4 space-y-4">
        {orders.map((order) => {
          const canRepair =
            order.status === "paid" &&
            order.fulfillment.invalidTicketCount === 0 &&
            (
              order.fulfillment.missingTicketCount > 0 ||
              order.fulfillment.unsentEmailCount > 0
            );

          const repairResult =
            repairResults[order.id];

          return (
            <article
              key={order.id}
              className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft"
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-royal">
                    {order.event?.name ?? "Unknown event"}
                  </p>

                  <h2 className="mt-2 text-2xl font-black text-royalDark">
                    {order.publicReference ?? "No public reference"}
                  </h2>

                  <p className="mt-2 text-muted">
                    {order.buyerFullName} · {order.buyerEmail}
                  </p>

                  <p className="mt-1 text-sm text-muted">
                    {order.buyerPhone}
                  </p>
                </div>

                <div className="flex flex-wrap items-start gap-3">
                  <span className="rounded-full border border-purple-200 bg-lavender px-4 py-2 text-sm font-semibold text-royalDark">
                    {formatStatus(order.status)}
                  </span>

                  <span
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${fulfillmentClass(
                      order.fulfillment.state
                    )}`}
                  >
                    {fulfillmentLabel(
                      order.fulfillment.state
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <OrderField
                  label="Order total"
                  value={formatMoney(
                    order.totalAmountNgn
                  )}
                />

                <OrderField
                  label="Attendees"
                  value={String(
                    order.fulfillment.attendeeCount
                  )}
                />

                <OrderField
                  label="Valid tickets"
                  value={`${order.fulfillment.validTicketCount} / ${order.fulfillment.attendeeCount}`}
                />

                <OrderField
                  label="Unsent emails"
                  value={String(
                    order.fulfillment.unsentEmailCount
                  )}
                />

                <OrderField
                  label="Missing tickets"
                  value={String(
                    order.fulfillment.missingTicketCount
                  )}
                />

                <OrderField
                  label="Invalid tickets"
                  value={String(
                    order.fulfillment.invalidTicketCount
                  )}
                />

                <OrderField
                  label="Created"
                  value={new Date(
                    order.createdAt
                  ).toLocaleString()}
                />

                <OrderField
                  label="Paid"
                  value={
                    order.paidAt
                      ? new Date(
                          order.paidAt
                        ).toLocaleString()
                      : "Not paid"
                  }
                />
              </div>

              <div className="mt-6 rounded-2xl bg-lavender p-4">
                <p className="text-sm font-semibold text-royalDark">
                  Attendees
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {order.attendees.map((attendee) => (
                    <span
                      key={attendee.id}
                      className="rounded-full bg-white px-3 py-2 text-sm text-muted"
                    >
                      {attendee.firstName}{" "}
                      {attendee.lastName}
                    </span>
                  ))}
                </div>
              </div>

              {order.fulfillment.invalidTicketCount > 0 && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  This order contains an invalidated ticket. Automatic repair
                  is disabled because the invalidation may have been
                  intentional.
                </div>
              )}

              {repairResult && (
                <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  <p className="font-semibold">
                    Fulfillment repair completed
                  </p>

                  <p className="mt-1">
                    Tickets created:{" "}
                    {repairResult.ticketsCreated}
                    {" · "}
                    Emails sent:{" "}
                    {repairResult.email.sent}
                    {" · "}
                    Already sent:{" "}
                    {repairResult.email.alreadySent}
                    {" · "}
                    Failures:{" "}
                    {repairResult.email.failures.length}
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                {canRepair && (
                  <button
                    type="button"
                    disabled={
                      repairingOrderId === order.id
                    }
                    onClick={() =>
                      repairFulfillment(order.id)
                    }
                    className="rounded-full bg-royal px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {repairingOrderId === order.id
                      ? "Repairing..."
                      : order.fulfillment.missingTicketCount > 0
                        ? "Repair Fulfillment"
                        : "Retry Ticket Emails"}
                  </button>
                )}

                {order.status === "paid" &&
                  order.fulfillment.state ===
                    "complete" && (
                    <p className="rounded-full border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">
                      Fulfillment complete
                    </p>
                  )}
              </div>
            </article>
          );
        })}

        {!loading && orders.length === 0 && (
          <div className="rounded-[2rem] border border-purple-100 bg-white p-8 text-center shadow-soft">
            <p className="text-muted">
              No matching registration orders found.
            </p>
          </div>
        )}
      </section>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() =>
            setPage((current) =>
              Math.max(1, current - 1)
            )
          }
          className="rounded-full border border-purple-200 px-5 py-3 text-sm font-semibold text-royal disabled:opacity-50"
        >
          Previous
        </button>

        <p className="text-sm text-muted">
          Page {page} of {totalPages}
        </p>

        <button
          type="button"
          disabled={
            page >= totalPages || loading
          }
          onClick={() =>
            setPage((current) => current + 1)
          }
          className="rounded-full border border-purple-200 px-5 py-3 text-sm font-semibold text-royal disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function OrderField({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-purple-100 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </p>

      <p className="mt-2 font-semibold text-royalDark">
        {value}
      </p>
    </div>
  );
}