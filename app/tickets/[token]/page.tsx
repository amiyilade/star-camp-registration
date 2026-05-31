import Link from "next/link";

type TicketPageProps = {
  params: Promise<{
    token: string;
  }>;
};

async function getTicket(token: string) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const response = await fetch(`${appUrl}/api/tickets/${token}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  return data.ticket;
}

export default async function TicketPage({ params }: TicketPageProps) {
  const { token } = await params;

  const ticket = await getTicket(token);

  if (!ticket) {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-red-100 bg-white p-10 text-center shadow-soft">
          <h1 className="text-3xl font-semibold text-red-700">
            Ticket not found
          </h1>

          <p className="mt-3 text-muted">
            This ticket link may be invalid or expired.
          </p>

          <Link
            href="/"
            className="mt-8 inline-flex rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white"
          >
            Return home
          </Link>
        </div>
      </main>
    );
  }

  const attendee = Array.isArray(ticket.attendees)
    ? ticket.attendees[0]
    : ticket.attendees;

  const event = Array.isArray(ticket.events)
    ? ticket.events[0]
    : ticket.events;

  const eventDate =
    event?.date_start && event?.date_end
      ? `${event.date_start} to ${event.date_end}`
      : "Date to be announced";

  return (
    <main className="min-h-screen bg-lavender px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-purple-100 bg-white p-8 shadow-soft">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
            STAR Camp Ticket
          </p>

          <h1 className="mt-4 text-3xl font-semibold text-royalDark">
            {event?.name}
          </h1>

          <p className="mt-2 text-muted">
            {event?.location} · {eventDate}
          </p>
        </div>

        <div className="mt-8 rounded-[2rem] bg-lavender p-6">
          <p className="text-sm font-semibold text-muted">
            Attendee
          </p>

          <p className="mt-1 text-2xl font-semibold text-royalDark">
            {attendee?.first_name} {attendee?.last_name}
          </p>

          <p className="mt-2 text-muted">
            {attendee?.email || "Ticket sent to buyer email"}
          </p>

          <p className="mt-2 text-muted">
            Department: {attendee?.department}
          </p>
        </div>

        <div className="mt-8 text-center">
        <img
            src={`/api/tickets/${token}/qr`}
            alt="Ticket QR Code"
            className="mx-auto rounded-2xl border border-purple-100 bg-white p-3"
            width={280}
            height={280}
        />

        <p className="mt-3 text-sm text-muted">
            Present this QR code at check-in.
        </p>
        </div>

        <div className="mt-6 rounded-[2rem] border border-purple-100 p-6 text-center">
          <p className="text-sm text-muted">
            Ticket Code
          </p>

          <p className="mt-2 text-2xl font-bold tracking-wide text-royal">
            {ticket.ticket_code}
          </p>
        </div>

        <div className="mt-6 rounded-[2rem] border border-purple-100 p-6">
          <p className="text-sm font-semibold text-muted">
            Status
          </p>

          <p className="mt-2 text-lg font-semibold text-royalDark">
            {ticket.status}
          </p>

          {ticket.checked_in_at && (
            <p className="mt-2 text-sm text-muted">
              Checked in: {ticket.checked_in_at}
            </p>
          )}

          {ticket.checked_out_at && (
            <p className="mt-2 text-sm text-muted">
              Checked out: {ticket.checked_out_at}
            </p>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full border border-purple-200 px-6 py-3 text-sm font-semibold text-royal hover:bg-lavender"
          >
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}