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

type Campaign = {
  id: string;
  name: string;
  description: string | null;

  funding_type:
    | "fixed_per_attendee"
    | "full_fee";

  funding_value_ngn: number | null;

  eligibility_mode:
    | "code"
    | "email"
    | "code_and_email";

  attendee_limit: number | null;

  is_active: boolean;

  sponsorship_codes: Array<{
    id: string;
    code: string;
    attendee_usage_limit: number | null;
    is_active: boolean;
  }>;

  sponsorship_email_eligibility: Array<{
    id: string;
    email: string;
    attendee_limit: number;
    is_active: boolean;
  }>;

  usage: {
    confirmedAttendees: number;
    reservedAttendees: number;
    confirmedAmountNgn: number;
    reservedAmountNgn: number;
  };
};

function money(amount: number) {
  return new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0
    }
  ).format(amount);
}

export function AdminSponsorshipsClient() {
  const [events, setEvents] =
    useState<EventOption[]>([]);

  const [eventSlug, setEventSlug] =
    useState("");

  const [campaigns, setCampaigns] =
    useState<Campaign[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [
    fundingType,
    setFundingType
  ] = useState<
    "fixed_per_attendee" | "full_fee"
  >("fixed_per_attendee");

  const [
    fundingValueNgn,
    setFundingValueNgn
  ] = useState("");

  const [
    eligibilityMode,
    setEligibilityMode
  ] = useState<
    "code" |
    "email" |
    "code_and_email"
  >("code");

  const [
    attendeeLimit,
    setAttendeeLimit
  ] = useState("");

  const [code, setCode] =
    useState("");

  const [
    codeUsageLimit,
    setCodeUsageLimit
  ] = useState("");

  const [
    approvedEmailsText,
    setApprovedEmailsText
  ] = useState("");

  async function loadCampaigns(
    requestedEventSlug?: string
  ) {
    try {
      setLoading(true);
      setError(null);

      const params =
        new URLSearchParams();

      if (requestedEventSlug) {
        params.set(
          "eventSlug",
          requestedEventSlug
        );
      }

      const query =
        params.toString()
          ? `?${params.toString()}`
          : "";

      const response = await fetch(
        `/api/admin/sponsorships${query}`,
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
            "Could not load sponsorship campaigns."
        );

        return;
      }

      setEvents(
        result.availableEvents ?? []
      );

      setEventSlug(
        result.event?.slug ?? ""
      );

      setCampaigns(
        result.campaigns ?? []
      );
    } catch {
      setError(
        "Something went wrong while loading sponsorship campaigns."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setFundingType(
      "fixed_per_attendee"
    );
    setFundingValueNgn("");
    setEligibilityMode("code");
    setAttendeeLimit("");
    setCode("");
    setCodeUsageLimit("");
    setApprovedEmailsText("");
  }

  async function createCampaign() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const emails =
        approvedEmailsText
          .split(/[\n,;]+/)
          .map((email) =>
            email.trim()
          )
          .filter(Boolean);

      const response = await fetch(
        "/api/admin/sponsorships",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            eventSlug,
            name,
            description,

            fundingType,

            fundingValueNgn:
              fundingType ===
              "fixed_per_attendee"
                ? fundingValueNgn
                : null,

            eligibilityMode,

            attendeeLimit:
              attendeeLimit || null,

            code:
              eligibilityMode ===
                "email"
                ? null
                : code,

            codeUsageLimit:
              eligibilityMode ===
                "email"
                ? null
                : codeUsageLimit ||
                  null,

            emails:
              eligibilityMode ===
                "code"
                ? []
                : emails
          })
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        setError(
          result.error ??
            "Could not create sponsorship campaign."
        );
        return;
      }

      resetForm();

      setSuccess(
        "Sponsorship campaign created."
      );

      await loadCampaigns(
        eventSlug
      );

      window.setTimeout(
        () => setSuccess(null),
        3000
      );
    } catch {
      setError(
        "Something went wrong while creating the sponsorship campaign."
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const requiresCode =
    eligibilityMode === "code" ||
    eligibilityMode ===
      "code_and_email";

  const requiresEmail =
    eligibilityMode === "email" ||
    eligibilityMode ===
      "code_and_email";

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-royal">
        STAR Camp Admin
      </p>

      <h1 className="mt-2 text-4xl font-semibold text-royalDark">
        Sponsorships
      </h1>

      <p className="mt-2 text-muted">
        Create and manage sponsorship
        allocations for eligible attendees.
      </p>

      <section className="mt-8 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
        <label className="block">
          <span className="text-sm font-semibold text-royalDark">
            Event
          </span>

          <select
            value={eventSlug}
            disabled={
              loading || saving
            }
            onChange={(event) => {
              const nextSlug =
                event.target.value;

              setEventSlug(
                nextSlug
              );

              loadCampaigns(
                nextSlug
              );
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

      <section className="mt-6 rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft">
        <h2 className="text-2xl font-black text-royalDark">
          Create campaign
        </h2>

        <div className="mt-6 grid gap-5">
          <label>
            <span className="text-sm font-semibold text-royalDark">
              Campaign name
            </span>

            <input
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              placeholder="Example: STAR Camp Access Fund"
              className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-royalDark">
              Description
            </span>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              rows={3}
              className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3"
            />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className="text-sm font-semibold text-royalDark">
                Sponsorship amount
              </span>

              <select
                value={fundingType}
                onChange={(event) =>
                  setFundingType(
                    event.target.value as
                      | "fixed_per_attendee"
                      | "full_fee"
                  )
                }
                className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3"
              >
                <option value="fixed_per_attendee">
                  Fixed amount per attendee
                </option>

                <option value="full_fee">
                  Full registration fee
                </option>
              </select>
            </label>

            {fundingType ===
              "fixed_per_attendee" && (
              <label>
                <span className="text-sm font-semibold text-royalDark">
                  Amount per attendee (₦)
                </span>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={fundingValueNgn}
                  onChange={(event) =>
                    setFundingValueNgn(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3"
                />
              </label>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className="text-sm font-semibold text-royalDark">
                Eligibility
              </span>

              <select
                value={eligibilityMode}
                onChange={(event) =>
                  setEligibilityMode(
                    event.target.value as
                      | "code"
                      | "email"
                      | "code_and_email"
                  )
                }
                className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3"
              >
                <option value="code">
                  Sponsorship code
                </option>

                <option value="email">
                  Approved attendee email
                </option>

                <option value="code_and_email">
                  Code + approved attendee email
                </option>
              </select>
            </label>

            <label>
              <span className="text-sm font-semibold text-royalDark">
                Campaign attendee limit
              </span>

              <input
                type="number"
                min="1"
                step="1"
                value={attendeeLimit}
                onChange={(event) =>
                  setAttendeeLimit(
                    event.target.value
                  )
                }
                placeholder="Leave blank for no campaign limit"
                className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3"
              />
            </label>
          </div>

          {requiresCode && (
            <div className="grid gap-5 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-royalDark">
                  Sponsorship code
                </span>

                <input
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .toUpperCase()
                        .replace(
                          /\s+/g,
                          ""
                        )
                    )
                  }
                  placeholder="ACCESS2026"
                  className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3 uppercase"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-royalDark">
                  Code attendee limit
                </span>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={codeUsageLimit}
                  onChange={(event) =>
                    setCodeUsageLimit(
                      event.target.value
                    )
                  }
                  placeholder="Leave blank to use campaign limit"
                  className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3"
                />
              </label>
            </div>
          )}

          {requiresEmail && (
            <label>
              <span className="text-sm font-semibold text-royalDark">
                Approved attendee emails
              </span>

              <textarea
                value={approvedEmailsText}
                onChange={(event) =>
                  setApprovedEmailsText(
                    event.target.value
                  )
                }
                rows={6}
                placeholder={`ada@example.com
chidi@example.com
musa@example.com`}
                className="mt-2 w-full rounded-2xl border border-purple-100 px-4 py-3"
              />

              <p className="mt-2 text-xs text-muted">
                One email per line. Commas and
                semicolons are also accepted.
                These addresses are never exposed
                to registrants.
              </p>
            </label>
          )}

          <button
            type="button"
            disabled={
              saving ||
              !eventSlug ||
              !name.trim() ||
              (
                fundingType ===
                  "fixed_per_attendee" &&
                Number(
                  fundingValueNgn
                ) <= 0
              ) ||
              (
                requiresCode &&
                code.trim().length < 4
              ) ||
              (
                requiresEmail &&
                approvedEmailsText
                  .trim()
                  .length === 0
              )
            }
            onClick={createCampaign}
            className="w-fit rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Creating..."
              : "Create Sponsorship Campaign"}
          </button>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-2xl font-black text-royalDark">
          Existing campaigns
        </h2>

        {loading && (
          <p className="text-sm text-muted">
            Loading campaigns...
          </p>
        )}

        {!loading &&
          campaigns.length === 0 && (
            <div className="rounded-[2rem] border border-purple-100 bg-white p-8 text-center shadow-soft">
              <p className="text-muted">
                No sponsorship campaigns have
                been created for this event.
              </p>
            </div>
          )}

        {campaigns.map(
          (campaign) => (
            <article
              key={campaign.id}
              className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-soft"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row">
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                      campaign.is_active
                        ? "text-green-700"
                        : "text-muted"
                    }`}
                  >
                    {campaign.is_active
                      ? "Active"
                      : "Inactive"}
                  </p>

                  <h3 className="mt-2 text-2xl font-black text-royalDark">
                    {campaign.name}
                  </h3>

                  {campaign.description && (
                    <p className="mt-2 text-sm text-muted">
                      {
                        campaign.description
                      }
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-lavender px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Benefit
                  </p>

                  <p className="mt-1 font-black text-royalDark">
                    {campaign.funding_type ===
                    "full_fee"
                      ? "Full fee"
                      : `${money(
                          campaign.funding_value_ngn ??
                            0
                        )} / attendee`}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <CampaignField
                  label="Eligibility"
                  value={
                    campaign.eligibility_mode ===
                    "code_and_email"
                      ? "Code + email"
                      : campaign.eligibility_mode ===
                          "email"
                        ? "Approved email"
                        : "Code"
                  }
                />

                <CampaignField
                  label="Campaign limit"
                  value={
                    campaign.attendee_limit
                      ? `${campaign.attendee_limit} attendees`
                      : "No limit"
                  }
                />

                <CampaignField
                  label="Confirmed"
                  value={String(
                    campaign.usage
                      .confirmedAttendees
                  )}
                />

                <CampaignField
                  label="Reserved"
                  value={String(
                    campaign.usage
                      .reservedAttendees
                  )}
                />
              </div>

              {campaign
                .sponsorship_codes
                ?.length > 0 && (
                <div className="mt-5 rounded-2xl bg-lavender p-4">
                  <p className="text-sm font-semibold text-royalDark">
                    Sponsorship code
                  </p>

                  {campaign.sponsorship_codes.map(
                    (item) => (
                      <p
                        key={item.id}
                        className="mt-2 font-mono text-lg font-bold text-royal"
                      >
                        {item.code}
                        {item.attendee_usage_limit
                          ? ` · max ${item.attendee_usage_limit}`
                          : ""}
                      </p>
                    )
                  )}
                </div>
              )}

              {campaign
                .sponsorship_email_eligibility
                ?.length > 0 && (
                <div className="mt-5 rounded-2xl border border-purple-100 p-4">
                  <p className="text-sm font-semibold text-royalDark">
                    Approved emails
                  </p>

                  <p className="mt-1 text-sm text-muted">
                    {
                      campaign
                        .sponsorship_email_eligibility
                        .filter(
                          (item) =>
                            item.is_active
                        ).length
                    }{" "}
                    active beneficiary email
                    {
                      campaign
                        .sponsorship_email_eligibility
                        .filter(
                          (item) =>
                            item.is_active
                        ).length === 1
                        ? ""
                        : "s"
                    }
                  </p>
                </div>
              )}
            </article>
          )
        )}
      </section>
    </div>
  );
}

function CampaignField({
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