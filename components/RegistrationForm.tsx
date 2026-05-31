"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import { ABUJA_AREAS, COUNTRY_CODES, DEPARTMENTS, NIGERIAN_STATES, OWERRI_AREAS } from "@/lib/registration-data";
import { EVENTS } from "@/lib/events";
import { RegistrationFormData, registrationSchema } from "@/lib/registration-schema";

const defaultPhone = { countryCode: "+234", number: "" };

const emptyContact = () => ({ name: "", phone: { ...defaultPhone }, relationship: "", email: "" });
const emptyAttendee = () => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: { ...defaultPhone },
  dateOfBirth: "",
  gender: "Female" as const,
  residenceArea: "",
  otherState: "",
  country: "",
  department: "Not a Volunteer",
  medicalNotes: "",
  guardian: emptyContact(),
  emergencyContact: emptyContact(),
  pickupAuthority: "guardian" as const,
  authorizedPickup: emptyContact(),
  lastCampExperience: "Never attended" as const,
  experienceComments: "",
  consentAccuracy: false,
  consentCommunication: false,
  consentMedia: false,
  consentGuardian: false,
  interestedInMerch: "No" as const
});

function calculateAge(dateOfBirth?: string) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

function money(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-sm font-medium text-royalDark">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 outline-none transition focus:border-royal focus:ring-4 focus:ring-purple-100" />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="min-h-24 w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 outline-none transition focus:border-royal focus:ring-4 focus:ring-purple-100" />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 outline-none transition focus:border-royal focus:ring-4 focus:ring-purple-100" />;
}

function PhoneInput({ register, prefix, error }: { register: any; prefix: string; error?: any }) {
  return (
    <div>
      <div className="grid grid-cols-[130px_1fr] gap-2">
        <Select {...register(`${prefix}.countryCode`)}>
          {COUNTRY_CODES.map((code) => (
            <option key={`${code.label}-${code.value}`} value={code.value}>{code.value} {code.label}</option>
          ))}
        </Select>
        <TextInput {...register(`${prefix}.number`)} placeholder="8012345678" inputMode="tel" />
      </div>
      <FieldError message={error?.countryCode?.message || error?.number?.message} />
    </div>
  );
}

function ContactFields({ title, register, prefix, errors, includeEmail = false }: { title: string; register: any; prefix: string; errors?: any; includeEmail?: boolean }) {
  return (
    <div className="rounded-3xl bg-lavender/60 p-5">
      <h4 className="mb-4 font-semibold text-royalDark">{title}</h4>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Full name</Label>
          <TextInput {...register(`${prefix}.name`)} />
          <FieldError message={errors?.name?.message} />
        </div>
        <div>
          <Label>Relationship</Label>
          <TextInput {...register(`${prefix}.relationship`)} placeholder="Parent, sibling, pastor..." />
          <FieldError message={errors?.relationship?.message} />
        </div>
        <div className={includeEmail ? "" : "md:col-span-2"}>
          <Label>Phone number</Label>
          <PhoneInput register={register} prefix={`${prefix}.phone`} error={errors?.phone} />
        </div>
        {includeEmail && (
          <div>
            <Label>Email address optional</Label>
            <TextInput {...register(`${prefix}.email`)} type="email" />
            <FieldError message={errors?.email?.message} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegistrationForm() {
  const [step, setStep] = useState(0);
  const [submittedData, setSubmittedData] = useState<RegistrationFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewReady, setReviewReady] = useState(false);

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: "onBlur",
    defaultValues: {
      eventSlug: "abuja-2026",
      ticketQuantity: 1,
      buyer: { fullName: "", email: "", phone: { ...defaultPhone } },
      attendees: [emptyAttendee()]
    }
  });

  const { register, control, watch, setValue, trigger, handleSubmit, formState: { errors } } = form;
  const { fields, replace } = useFieldArray({ control, name: "attendees" });

  const eventSlug = watch("eventSlug");
  const ticketQuantity = watch("ticketQuantity");
  const selectedEvent = EVENTS.find((event) => event.slug === eventSlug) ?? EVENTS[0];
  const residenceOptions = selectedEvent.location === "Abuja" ? ABUJA_AREAS : OWERRI_AREAS;
  const attendees = watch("attendees");
  const total = selectedEvent.price * Number(ticketQuantity || 1);

  useEffect(() => {
    if (step === 4) {
      setReviewReady(false);

      const timer = window.setTimeout(() => {
        setReviewReady(true);
      }, 700);

      return () => window.clearTimeout(timer);
    }

    setReviewReady(false);
  }, [step]);

  function syncTicketQuantity(quantity: number) {
    const safeQuantity = Math.min(Math.max(quantity, 1), 10);
    const current = form.getValues("attendees") || [];
    const next = Array.from({ length: safeQuantity }, (_, index) => current[index] ?? emptyAttendee());
    setValue("ticketQuantity", safeQuantity);
    replace(next);
  }

  async function nextStep() {
    let fieldsToValidate: string[] = [];

    if (step === 0) {
      fieldsToValidate = ["eventSlug", "ticketQuantity"];
    }

    if (step === 1) {
      fieldsToValidate = [
        "buyer.fullName",
        "buyer.email",
        "buyer.phone.countryCode",
        "buyer.phone.number"
      ];
    }

    if (step === 2) {
      const attendees = form.getValues("attendees");

      fieldsToValidate = attendees.flatMap((attendee, index) => {
        const age = calculateAge(attendee.dateOfBirth);
        const isUnder20 = age !== null && age < 20;

        const fields = [
          `attendees.${index}.firstName`,
          `attendees.${index}.lastName`,
          `attendees.${index}.email`,
          `attendees.${index}.phone.countryCode`,
          `attendees.${index}.phone.number`,
          `attendees.${index}.dateOfBirth`,
          `attendees.${index}.gender`,
          `attendees.${index}.residenceArea`,
          `attendees.${index}.department`,
          `attendees.${index}.lastCampExperience`,
          `attendees.${index}.interestedInMerch`
        ];

        if (attendee.residenceArea === "Other Nigerian State") {
          fields.push(`attendees.${index}.otherState`);
        }

        if (attendee.residenceArea === "Outside Nigeria") {
          fields.push(`attendees.${index}.country`);
        }

        if (isUnder20) {
          fields.push(
            `attendees.${index}.guardian.name`,
            `attendees.${index}.guardian.relationship`,
            `attendees.${index}.guardian.phone.countryCode`,
            `attendees.${index}.guardian.phone.number`,
            `attendees.${index}.pickupAuthority`
          );

          if (attendee.pickupAuthority === "other") {
            fields.push(
              `attendees.${index}.authorizedPickup.name`,
              `attendees.${index}.authorizedPickup.relationship`,
              `attendees.${index}.authorizedPickup.phone.countryCode`,
              `attendees.${index}.authorizedPickup.phone.number`
            );
          }
        }

        if (age !== null && !isUnder20) {
          fields.push(
            `attendees.${index}.emergencyContact.name`,
            `attendees.${index}.emergencyContact.relationship`,
            `attendees.${index}.emergencyContact.phone.countryCode`,
            `attendees.${index}.emergencyContact.phone.number`
          );
        }

        return fields;
      });
    }

    if (step === 3) {
      const attendees = form.getValues("attendees");

      fieldsToValidate = attendees.flatMap((attendee, index) => {
        const age = calculateAge(attendee.dateOfBirth);
        const isUnder20 = age !== null && age < 20;

        const fields = [
          `attendees.${index}.consentAccuracy`,
          `attendees.${index}.consentCommunication`,
          `attendees.${index}.consentMedia`
        ];

        if (isUnder20) {
          fields.push(`attendees.${index}.consentGuardian`);
        }

        return fields;
      });
    }

    const ok = await trigger(fieldsToValidate as any, {
      shouldFocus: true
    });

    console.log("Current step:", step);
    console.log("Next step validation ok:", ok);

    if (ok) {
      setStep((current) => Math.min(current + 1, 4));
    } else {
      console.log("Validation failed:", form.formState.errors);
    }
  }

  function copyFromPrevious(index: number) {
    const previous = form.getValues(`attendees.${index - 1}`);
    if (!previous) return;
    setValue(`attendees.${index}.residenceArea`, previous.residenceArea);
    setValue(`attendees.${index}.otherState`, previous.otherState);
    setValue(`attendees.${index}.country`, previous.country);
    setValue(`attendees.${index}.department`, previous.department);
    setValue(`attendees.${index}.guardian`, previous.guardian);
    setValue(`attendees.${index}.emergencyContact`, previous.emergencyContact);
    setValue(`attendees.${index}.pickupAuthority`, previous.pickupAuthority);
    setValue(`attendees.${index}.authorizedPickup`, previous.authorizedPickup);
  }

  const steps = ["Camp", "Buyer", "Attendees", "Consent", "Review"];

  if (submittedData) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-purple-100 bg-white p-8 text-center shadow-soft">
          <CheckCircle2 className="mx-auto text-royal" size={52} />

          <h1 className="mt-6 text-3xl font-semibold text-royalDark">
            Registration captured successfully
          </h1>

          <p className="mt-3 text-muted">
            A confirmation email and payment page will be connected next.
          </p>

          <a
            href="/"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-royalDark">
            Return to Homepage
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 border-b border-purple-100 pb-6">
          <div className="flex items-center gap-4">
            <Image src="/tkh-logo.png" alt="The King's Hub logo" width={72} height={72} />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold">The King&apos;s Hub</p>
              <h1 className="text-2xl font-semibold text-royalDark md:text-3xl">STAR Camp Registration</h1>
            </div>
          </div>
          <div className="hidden rounded-full bg-lavender px-5 py-3 text-sm font-medium text-royalDark md:block">
            {selectedEvent.name}
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-[2rem] bg-lavender/70 p-5">
            <div className="space-y-3">
              {steps.map((label, index) => (
                <div key={label} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${index === step ? "bg-white font-semibold text-royal shadow-sm" : "text-muted"}`}>
                  <span className={`grid h-7 w-7 place-items-center rounded-full ${index <= step ? "bg-royal text-white" : "bg-white text-muted"}`}>{index + 1}</span>
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-3xl bg-white p-4 text-sm text-muted">
              <p className="font-semibold text-royalDark">Order summary</p>
              <p className="mt-2">Tickets: {ticketQuantity || 1}</p>
              <p>Price: {money(selectedEvent.price)} each</p>
              <p className="mt-2 text-lg font-semibold text-royalDark">Total: {money(total)}</p>
            </div>
          </aside>

          <form
            onSubmit={handleSubmit(
              async (data) => {
                try {
                  setIsSubmitting(true);

                  console.log("Registration data", data);

                  const response = await fetch("/api/registrations", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify(data)
                  });

                  const result = await response.json();

                  if (!response.ok) {
                    console.error("Save failed:", result);
                    alert(result.error ?? "Could not save registration draft.");
                    return;
                  }

                  console.log("Saved registration:", result);

                  if (result.paymentUrl) {
                    window.location.href = result.paymentUrl;
                    return;
                  }

                  setSubmittedData(data);

                } catch (error) {
                  console.error(error);
                  alert("Something went wrong while saving the registration.");
                } finally {
                  setIsSubmitting(false);
                }
              },
              (errors) => {
                console.log("Submit validation errors:", errors);
                console.log("Submit validation errors JSON:", JSON.stringify(errors, null, 2));
                alert("Some required information is missing. Check the browser console for details.");
              }
            )}
            className="rounded-[2rem] border border-purple-100 bg-white p-5 shadow-soft md:p-8">
            {step === 0 && (
              <section>
                <h2 className="text-3xl font-semibold text-royalDark">Choose your camp</h2>
                <p className="mt-2 text-muted">Select the edition and number of tickets.</p>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {EVENTS.map((event) => (
                    <button
                      type="button"
                      key={event.slug}
                      onClick={() => setValue("eventSlug", event.slug)}
                      className={`rounded-[2rem] border p-6 text-left transition ${eventSlug === event.slug ? "border-royal bg-lavender shadow-soft" : "border-purple-100 bg-white hover:border-royal"}`}
                    >
                      <p className="text-xl font-semibold text-royalDark">{event.name}</p>
                      <p className="mt-2 text-muted">{event.dateStart ? "5–9 August 2026" : "Date to be announced"}</p>
                      <p className="mt-4 text-2xl font-semibold text-royal">{money(event.price)}</p>
                    </button>
                  ))}
                </div>
                <FieldError message={errors.eventSlug?.message} />
                <div className="mt-8 max-w-xs">
                  <Label>Ticket quantity max 10</Label>
                  <Select value={ticketQuantity} onChange={(e) => syncTicketQuantity(Number(e.target.value))}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => <option key={num} value={num}>{num}</option>)}
                  </Select>
                </div>
              </section>
            )}

            {step === 1 && (
              <section>
                <h2 className="text-3xl font-semibold text-royalDark">Buyer details</h2>
                <p className="mt-2 text-muted">The buyer receives the order summary. If an attendee has no email, their ticket goes to the buyer email.</p>
                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>Full name</Label>
                    <TextInput {...register("buyer.fullName")} />
                    <FieldError message={errors.buyer?.fullName?.message} />
                  </div>
                  <div>
                    <Label>Email address</Label>
                    <TextInput {...register("buyer.email")} type="email" />
                    <FieldError message={errors.buyer?.email?.message} />
                  </div>
                  <div>
                    <Label>Phone number</Label>
                    <PhoneInput register={register} prefix="buyer.phone" error={errors.buyer?.phone} />
                  </div>
                </div>
              </section>
            )}

            {step === 2 && (
              <section>
                <h2 className="text-3xl font-semibold text-royalDark">Attendee details</h2>
                <p className="mt-2 text-muted">Complete details for each ticket.</p>
                <div className="mt-8 space-y-8">
                  {fields.map((field, index) => {
                    const age = calculateAge(attendees?.[index]?.dateOfBirth);
                    const isUnder20 = age !== null && age < 20;
                    const area = attendees?.[index]?.residenceArea;
                    return (
                      <div key={field.id} className="rounded-[2rem] border border-purple-100 p-5 md:p-6">
                        <div className="mb-6 flex items-center justify-between gap-4">
                          <h3 className="text-xl font-semibold text-royalDark">Attendee {index + 1}</h3>
                          {index > 0 && <button type="button" onClick={() => copyFromPrevious(index)} className="inline-flex items-center gap-2 rounded-full bg-lavender px-4 py-2 text-xs font-semibold text-royal"><Copy size={14} /> Copy shared details</button>}
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                          <div>
                            <Label>First name</Label>
                            <TextInput {...register(`attendees.${index}.firstName`)} />
                            <FieldError message={errors.attendees?.[index]?.firstName?.message} />
                          </div>
                          <div>
                            <Label>Last name</Label>
                            <TextInput {...register(`attendees.${index}.lastName`)} />
                            <FieldError message={errors.attendees?.[index]?.lastName?.message} />
                          </div>
                          <div>
                            <Label>Email optional</Label>
                            <TextInput {...register(`attendees.${index}.email`)} type="email" />
                            <FieldError message={errors.attendees?.[index]?.email?.message} />
                          </div>
                          <div>
                            <Label>Phone number</Label>
                            <PhoneInput register={register} prefix={`attendees.${index}.phone`} error={errors.attendees?.[index]?.phone} />
                          </div>
                          <div>
                            <Label>Date of birth</Label>
                            <TextInput {...register(`attendees.${index}.dateOfBirth`)} type="date" />
                            <FieldError message={errors.attendees?.[index]?.dateOfBirth?.message} />
                            {age !== null && <p className="mt-1 text-xs text-muted">Age: {age}</p>}
                          </div>
                          <div>
                            <Label>Gender</Label>
                            <Select {...register(`attendees.${index}.gender`)}>
                              <option>Female</option>
                              <option>Male</option>
                            </Select>
                          </div>
                          <div>
                            <Label>Primary area of residence</Label>
                            <Select {...register(`attendees.${index}.residenceArea`)}>
                              <option value="">Select area</option>
                              {residenceOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                            </Select>
                            <FieldError message={errors.attendees?.[index]?.residenceArea?.message} />
                          </div>
                          {area === "Other Nigerian State" && (
                            <div>
                              <Label>State</Label>
                              <Select {...register(`attendees.${index}.otherState`)}>
                                <option value="">Select state</option>
                                {NIGERIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                              </Select>
                              <FieldError message={errors.attendees?.[index]?.otherState?.message} />
                            </div>
                          )}
                          {area === "Outside Nigeria" && (
                            <div>
                              <Label>Country</Label>
                              <TextInput {...register(`attendees.${index}.country`)} />
                              <FieldError message={errors.attendees?.[index]?.country?.message} />
                            </div>
                          )}
                          <div>
                            <Label>Department</Label>
                            <Select {...register(`attendees.${index}.department`)}>
                              {DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
                            </Select>
                          </div>
                          <div>
                            <Label>Interested in merch?</Label>
                            <Select {...register(`attendees.${index}.interestedInMerch`)}>
                              <option>Yes</option>
                              <option>No</option>
                            </Select>
                          </div>
                          <div className="md:col-span-2">
                            <Label>Medical notes optional</Label>
                            <TextArea {...register(`attendees.${index}.medicalNotes`)} placeholder="Short note on allergies or health issues, if any." />
                            <FieldError message={errors.attendees?.[index]?.medicalNotes?.message} />
                          </div>
                          <div>
                            <Label>Rate your last STAR Camp experience</Label>
                            <Select {...register(`attendees.${index}.lastCampExperience`)}>
                              <option>Never attended</option>
                              <option value="1">1 star</option>
                              <option value="2">2 stars</option>
                              <option value="3">3 stars</option>
                              <option value="4">4 stars</option>
                              <option value="5">5 stars</option>
                            </Select>
                          </div>
                          <div>
                            <Label>Optional comments</Label>
                            <TextArea {...register(`attendees.${index}.experienceComments`)} placeholder="Optional feedback from a previous camp." />
                          </div>
                        </div>

                        <div className="mt-6 space-y-5">
                          {age === null && <p className="rounded-2xl bg-lavender p-4 text-sm text-muted">Enter date of birth to show guardian or emergency contact fields.</p>}
                          {age !== null && isUnder20 && (
                            <>
                              <ContactFields title="Guardian details required because attendee is under 20" register={register} prefix={`attendees.${index}.guardian`} errors={errors.attendees?.[index]?.guardian} includeEmail />
                              <div>
                                <Label>Check-in/check-out authority</Label>
                                <Select {...register(`attendees.${index}.pickupAuthority`)}>
                                  <option value="guardian">Guardian listed above</option>
                                  <option value="other">Another authorized person</option>
                                </Select>
                                <FieldError message={errors.attendees?.[index]?.pickupAuthority?.message} />
                              </div>
                              {attendees?.[index]?.pickupAuthority === "other" && <ContactFields title="Authorized pickup person" register={register} prefix={`attendees.${index}.authorizedPickup`} errors={errors.attendees?.[index]?.authorizedPickup} />}
                            </>
                          )}
                          {age !== null && !isUnder20 && <ContactFields title="Emergency contact required because attendee is 20 or older" register={register} prefix={`attendees.${index}.emergencyContact`} errors={errors.attendees?.[index]?.emergencyContact} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {step === 3 && (
              <section>
                <h2 className="text-3xl font-semibold text-royalDark">Consent and confirmation</h2>
                <p className="mt-2 text-muted">Each attendee must confirm these details.</p>
                <div className="mt-8 space-y-6">
                  {fields.map((field, index) => {
                    const age = calculateAge(attendees?.[index]?.dateOfBirth);
                    const isUnder20 = age !== null && age < 20;
                    return (
                      <div key={field.id} className="rounded-[2rem] border border-purple-100 p-5">
                        <h3 className="font-semibold text-royalDark">Attendee {index + 1}: {attendees?.[index]?.firstName || "Unnamed"}</h3>
                        <div className="mt-4 space-y-3 text-sm text-royalDark">
                          <label className="flex gap-3"><input type="checkbox" {...register(`attendees.${index}.consentAccuracy`)} /> I confirm that the information provided is accurate.</label>
                          <FieldError message={errors.attendees?.[index]?.consentAccuracy?.message} />
                          <label className="flex gap-3"><input type="checkbox" {...register(`attendees.${index}.consentCommunication`)} /> I agree to receive camp-related emails and SMS updates.</label>
                          <FieldError message={errors.attendees?.[index]?.consentCommunication?.message} />
                          <label className="flex gap-3"><input type="checkbox" {...register(`attendees.${index}.consentMedia`)} /> I consent to photos/videos being taken during camp for ministry/event documentation.</label>
                          <FieldError message={errors.attendees?.[index]?.consentMedia?.message} />
                          {isUnder20 && (
                            <>
                              <label className="flex gap-3"><input type="checkbox" {...register(`attendees.${index}.consentGuardian`)} /> I confirm that the guardian listed is aware of and approves this registration.</label>
                              <FieldError message={errors.attendees?.[index]?.consentGuardian?.message} />
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {step === 4 && (
              <section>
                <h2 className="text-3xl font-semibold text-royalDark">Review registration</h2>
                <p className="mt-2 text-muted">Check the summary before continuing. Payment integration comes next.</p>
                <div className="mt-8 rounded-[2rem] bg-lavender p-6">
                  <p className="font-semibold text-royalDark">{selectedEvent.name}</p>
                  <p className="mt-2 text-muted">Buyer: {watch("buyer.fullName")} · {watch("buyer.email")}</p>
                  <p className="mt-2 text-muted">Tickets: {ticketQuantity} · Total: {money(total)}</p>
                </div>
                <div className="mt-6 space-y-4">
                  {attendees?.map((attendee, index) => (
                    <div key={index} className="rounded-3xl border border-purple-100 p-5">
                      <p className="font-semibold text-royalDark">{index + 1}. {attendee.firstName} {attendee.lastName}</p>
                      <p className="mt-1 text-sm text-muted">{attendee.email || "Ticket will be sent to buyer email"}</p>
                      <p className="mt-1 text-sm text-muted">{attendee.department} · {attendee.residenceArea}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex items-start gap-3 rounded-3xl bg-lavender p-5 text-sm text-muted">
                  <ShieldCheck className="mt-1 shrink-0 text-royal" size={22} />
                  <p>This frontend is ready for database and Paystack integration. On submit, it validates and displays the data locally.</p>
                </div>
              </section>
            )}

            <div className="mt-10 flex items-center justify-between border-t border-purple-100 pt-6">
              <button type="button" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0} className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-royal disabled:opacity-30">
                <ArrowLeft size={16} /> Back
              </button>
              {step < 4 ? (
                <button type="button" onClick={nextStep} className="inline-flex items-center gap-2 rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white shadow-soft hover:bg-royalDark">
                  Continue <ArrowRight size={16} />
                </button>
              ) : (
                <button type="submit" className="rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white shadow-soft hover:bg-royalDark" disabled={isSubmitting || !reviewReady}>
                   {isSubmitting
                    ? "Saving..."
                    : reviewReady
                      ? "Submit Registration Draft"
                      : "Review before submitting"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
