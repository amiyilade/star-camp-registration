import type { RegistrationFormData } from "@/lib/registration-schema";
import { EVENTS } from "@/lib/events";

function calculateAge(dateOfBirth?: string) {
  if (!dateOfBirth) return null;

  const today = new Date();
  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) return null;

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

function emptyToNull(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normaliseRegistrationForDatabase(data: RegistrationFormData) {
  const event = EVENTS.find((item) => item.slug === data.eventSlug);

  if (!event) {
    throw new Error("Invalid event selected.");
  }

  const unitPrice = event.price;
  const totalAmount = unitPrice * data.ticketQuantity;

  return {
    order: {
      event_slug: data.eventSlug,
      buyer_full_name: data.buyer.fullName.trim(),
      buyer_email: data.buyer.email.trim().toLowerCase(),
      buyer_phone_country_code: data.buyer.phone.countryCode,
      buyer_phone_number: data.buyer.phone.number.trim(),
      ticket_quantity: data.ticketQuantity,
      unit_price_ngn: unitPrice,
      total_amount_ngn: totalAmount,
      status: "draft",
      form_version: 1
    },

    attendees: data.attendees.map((attendee) => {
      const age = calculateAge(attendee.dateOfBirth);

      if (age === null) {
        throw new Error("Invalid attendee date of birth.");
      }

      const isUnder20 = age < 20;
      const usesOtherPickup =
        isUnder20 && attendee.pickupAuthority === "other";

      return {
        first_name: attendee.firstName.trim(),
        last_name: attendee.lastName.trim(),
        email: emptyToNull(attendee.email)?.toLowerCase() ?? null,
        phone_country_code: attendee.phone.countryCode,
        phone_number: attendee.phone.number.trim(),
        date_of_birth: attendee.dateOfBirth,
        age_at_registration: age,
        gender: attendee.gender,

        residence_area: attendee.residenceArea,
        other_state:
          attendee.residenceArea === "Other Nigerian State"
            ? emptyToNull(attendee.otherState)
            : null,
        country:
          attendee.residenceArea === "Outside Nigeria"
            ? emptyToNull(attendee.country)
            : null,

        department: attendee.department,
        medical_notes: emptyToNull(attendee.medicalNotes),

        guardian_name: isUnder20 ? emptyToNull(attendee.guardian?.name) : null,
        guardian_phone_country_code: isUnder20
          ? attendee.guardian?.phone?.countryCode ?? null
          : null,
        guardian_phone_number: isUnder20
          ? emptyToNull(attendee.guardian?.phone?.number)
          : null,
        guardian_relationship: isUnder20
          ? emptyToNull(attendee.guardian?.relationship)
          : null,
        guardian_email: null,
        emergency_contact_name: !isUnder20
          ? emptyToNull(attendee.emergencyContact?.name)
          : null,
        emergency_contact_phone_country_code: !isUnder20
          ? attendee.emergencyContact?.phone?.countryCode ?? null
          : null,
        emergency_contact_phone_number: !isUnder20
          ? emptyToNull(attendee.emergencyContact?.phone?.number)
          : null,
        emergency_contact_relationship: !isUnder20
          ? emptyToNull(attendee.emergencyContact?.relationship)
          : null,

        pickup_authority: isUnder20 ? attendee.pickupAuthority : null,
        authorized_pickup_name: usesOtherPickup
          ? emptyToNull(attendee.authorizedPickup?.name)
          : null,
        authorized_pickup_phone_country_code: usesOtherPickup
          ? attendee.authorizedPickup?.phone?.countryCode ?? null
          : null,
        authorized_pickup_phone_number: usesOtherPickup
          ? emptyToNull(attendee.authorizedPickup?.phone?.number)
          : null,
        authorized_pickup_relationship: usesOtherPickup
          ? emptyToNull(attendee.authorizedPickup?.relationship)
          : null,

        last_camp_experience: attendee.lastCampExperience,
        experience_comments: emptyToNull(attendee.experienceComments),
        interested_in_merch: attendee.interestedInMerch,

        consent_accuracy: attendee.consentAccuracy,
        consent_communication: attendee.consentCommunication,
        consent_media: attendee.consentMedia,
        consent_guardian: isUnder20 ? attendee.consentGuardian : false
      };
    })
  };
}