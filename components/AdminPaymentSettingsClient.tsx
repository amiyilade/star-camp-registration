"use client";

import {
  useEffect,
  useState
} from "react";

type EventOption = {
  id: string;
  name: string;
  slug: string;
  location: string | null;
};

type PaymentSettings = {
  event_id: string;
  paystack_enabled: boolean;
  cash_enabled: boolean;
  sponsorship_enabled: boolean;
  cash_payment_deadline_minutes: number;
  cash_instructions: string | null;
  updated_at: string;
  updated_by_email: string | null;
};

export function AdminPaymentSettingsClient() {
  const [events, setEvents] =
    useState<EventOption[]>([]);

  const [eventSlug, setEventSlug] =
    useState("");

  const [settings, setSettings] =
    useState<PaymentSettings | null>(null);

  const [paystackEnabled, setPaystackEnabled] =
    useState(true);

  const [cashEnabled, setCashEnabled] =
    useState(false);

  const [
    sponsorshipEnabled,
    setSponsorshipEnabled
  ] = useState(false);

  const [
    cashPaymentDeadlineMinutes,
    setCashPaymentDeadlineMinutes
  ] = useState(120);

  const [
    cashInstructions,
    setCashInstructions
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  async function loadSettings(
    requestedEventSlug?: string
  ) {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const params =
        new URLSearchParams();

      if (requestedEventSlug) {
        params.set(
          "eventSlug",
          requestedEventSlug
        );
      }

      const query =
        params.toString().length > 0
          ? `?${params.toString()}`
          : "";

      const response = await fetch(
        `/api/admin/payment-settings${query}`,
        {
          cache: "no-store"
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href =
            "/admin/login";

          return;
        }

        if (response.status === 403) {
          window.location.href =
            "/admin/scan";

          return;
        }

        setError(
          result.error ??
            "Could not load payment settings."
        );

        return;
      }

      setEvents(
        result.availableEvents ?? []
      );

      setEventSlug(
        result.event?.slug ?? ""
      );

      applySettings(result.settings);
    } catch {
      setError(
        "Something went wrong while loading payment settings."
      );
    } finally {
      setLoading(false);
    }
  }

  function applySettings(
    nextSettings: PaymentSettings
  ) {
    setSettings(nextSettings);

    setPaystackEnabled(
      nextSettings.paystack_enabled
    );

    setCashEnabled(
      nextSettings.cash_enabled
    );

    setSponsorshipEnabled(
      nextSettings.sponsorship_enabled
    );

    setCashPaymentDeadlineMinutes(
      nextSettings.cash_payment_deadline_minutes
    );

    setCashInstructions(
      nextSettings.cash_instructions ?? ""
    );
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        "/api/admin/payment-settings",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            eventSlug,
            paystackEnabled,
            cashEnabled,
            sponsorshipEnabled,
            cashPaymentDeadlineMinutes,
            cashInstructions
          })
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        setError(
          result.error ??
            "Could not save payment settings."
        );

        return;
      }

      applySettings(result.settings);

      setSuccess(
        "Payment settings saved."
      );

      window.setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch {
      setError(
        "Something went wrong while saving payment settings."
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading && !settings) {
    return (
      <p className="text-sm text-muted">
        Loading payment settings...
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
        STAR Camp Admin
      </p>

      <h1 className="mt-2 text-4xl font-semibold text-royalDark">
        Payment Settings
      </h1>

      <p className="mt-2 text-muted">
        Control the payment methods available
        for each camp.
      </p>

      <section className="mt-8 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
        <label className="block">
          <span className="text-sm font-semibold text-royalDark">
            Event
          </span>

          <select
            value={eventSlug}
            disabled={loading || saving}
            onChange={(event) => {
              const nextSlug =
                event.target.value;

              setEventSlug(nextSlug);

              loadSettings(nextSlug);
            }}
            className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3 md:max-w-md"
          >
            {events.map((event) => (
              <option
                key={event.id}
                value={event.slug}
              >
                {event.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
          {success}
        </div>
      )}

      <section className="mt-6 space-y-4">
        <PaymentMethodCard
          title="Paystack"
          description="Allow registrants to pay online through Paystack."
          enabled={paystackEnabled}
          onChange={setPaystackEnabled}
          disabled={saving}
        />

        <PaymentMethodCard
          title="Cash"
          description="Allow registrants to choose cash payment and receive a provisional payment reference."
          enabled={cashEnabled}
          onChange={setCashEnabled}
          disabled={saving}
        />

        <PaymentMethodCard
          title="Sponsorship"
          description="Allow eligible registrants to enter sponsorship codes."
          enabled={sponsorshipEnabled}
          onChange={setSponsorshipEnabled}
          disabled={saving}
        />
      </section>

      {cashEnabled && (
        <section className="mt-6 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-black text-royalDark">
            Cash payment configuration
          </h2>

          <p className="mt-2 text-sm text-muted">
            These instructions will eventually
            be shown after a registrant chooses
            cash payment.
          </p>

          <div className="mt-6 grid gap-5">
            <label>
              <span className="text-sm font-semibold text-royalDark">
                Payment deadline
              </span>

              <select
                value={
                  cashPaymentDeadlineMinutes
                }
                disabled={saving}
                onChange={(event) =>
                  setCashPaymentDeadlineMinutes(
                    Number(
                      event.target.value
                    )
                  )
                }
                className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3 md:max-w-sm"
              >
                <option value={30}>
                  30 minutes
                </option>

                <option value={60}>
                  1 hour
                </option>

                <option value={120}>
                  2 hours
                </option>

                <option value={180}>
                  3 hours
                </option>

                <option value={360}>
                  6 hours
                </option>

                <option value={720}>
                  12 hours
                </option>

                <option value={1440}>
                  24 hours
                </option>
              </select>
            </label>

            <label>
              <span className="text-sm font-semibold text-royalDark">
                Cash payment instructions
              </span>

              <textarea
                value={cashInstructions}
                disabled={saving}
                onChange={(event) =>
                  setCashInstructions(
                    event.target.value
                  )
                }
                rows={5}
                maxLength={1000}
                placeholder="Example: Take your payment reference to the STAR Camp registration desk. Your registration is not complete until payment is confirmed."
                className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3 outline-none focus:border-royal"
              />

              <p className="mt-2 text-xs text-muted">
                {cashInstructions.length}
                /1000
              </p>
            </label>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold text-royalDark">
              Save changes
            </p>

            {settings?.updated_at && (
              <p className="mt-1 text-xs text-muted">
                Last updated{" "}
                {new Date(
                  settings.updated_at
                ).toLocaleString()}
                {settings.updated_by_email
                  ? ` by ${settings.updated_by_email}`
                  : ""}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={
              saving ||
              (!paystackEnabled &&
                !cashEnabled) ||
              (cashEnabled &&
                cashInstructions.trim()
                  .length === 0)
            }
            onClick={saveSettings}
            className="rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : "Save Payment Settings"}
          </button>
        </div>

        {!paystackEnabled &&
          !cashEnabled && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              At least Paystack or cash must
              remain enabled. Sponsorship alone
              cannot serve as the general payment
              method because not every registrant
              may be eligible.
            </p>
          )}
      </section>
    </div>
  );
}

function PaymentMethodCard({
  title,
  description,
  enabled,
  onChange,
  disabled
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
      <div className="flex items-center justify-between gap-5">
        <div>
          <h2 className="text-xl font-black text-royalDark">
            {title}
          </h2>

          <p className="mt-2 text-sm text-muted">
            {description}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={disabled}
          onClick={() =>
            onChange(!enabled)
          }
          className={`relative h-8 w-14 shrink-0 rounded-full transition ${
            enabled
              ? "bg-royal"
              : "bg-slate-300"
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
              enabled
                ? "left-7"
                : "left-1"
            }`}
          />
        </button>
      </div>

      <p
        className={`mt-4 text-xs font-semibold uppercase tracking-[0.2em] ${
          enabled
            ? "text-green-700"
            : "text-muted"
        }`}
      >
        {enabled ? "Enabled" : "Disabled"}
      </p>
    </div>
  );
}