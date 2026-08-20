import { z } from "zod";

function calculateAge(dateOfBirth?: string) {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);

  if (Number.isNaN(dob.getTime())) return null;

  const cutoff = new Date("2026-08-31");

  let age = cutoff.getFullYear() - dob.getFullYear();

  const birthdayPassed =
    cutoff.getMonth() > dob.getMonth() ||
    (cutoff.getMonth() === dob.getMonth() &&
      cutoff.getDate() >= dob.getDate());

  if (!birthdayPassed) {
    age -= 1;
  }

  return age;
}

function normalizePhone(phone?: { countryCode?: string; number?: string }) {
  const countryCode = phone?.countryCode?.replace(/\D/g, "") ?? "";
  let number = phone?.number?.replace(/\D/g, "") ?? "";

  // Normalize local Nigerian-style leading zero: 0803... → 803...
  if (number.startsWith("0")) {
    number = number.slice(1);
  }

  if (!countryCode || !number) return "";

  return `${countryCode}${number}`;
}

const DUPLICATE_PHONE_MESSAGE =
  "This number matches the attendee’s own phone number. Please provide a different contact number.";

const phoneSchema = z.object({
  countryCode: z.string().min(1, "Select a country code"),
  number: z.string().min(7, "Enter a valid phone number").max(15, "Phone number is too long")
});

const optionalPhoneSchema = z.object({
  countryCode: z.string().default("+234"),
  number: z.string().optional().or(z.literal(""))
});

const requiredPhoneSchema = z.object({
  countryCode: z.string().min(1, "Country code is required"),
  number: z.string().min(7, "Enter a valid phone number")
});

const optionalContactSchema = z.object({
  name: z.string().optional().or(z.literal("")),
  phone: optionalPhoneSchema,
  relationship: z.string().optional().or(z.literal(""))
});

const requiredContactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: requiredPhoneSchema,
  relationship: z.string().min(2, "Relationship is required")
});

export const attendeeSchema = z
  .object({
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Last name is required"),
    email: z.string().email("Enter a valid email").optional().or(z.literal("")),
    phone: phoneSchema,
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.enum(["Female", "Male"], { message: "Select gender" }),
    residenceArea: z.string().min(1, "Select area of residence"),
    otherState: z.string().optional(),
    country: z.string().optional(),
    department: z.string().min(1, "Select department"),
    medicalNotes: z.string().max(200, "Keep medical notes short").optional(),
    guardian: optionalContactSchema,
    emergencyContact: optionalContactSchema,
    pickupAuthority: z.enum(["guardian", "other"]).optional(),
    authorizedPickup: optionalContactSchema,
    lastCampExperience: z.enum(["Never attended", "1", "2", "3", "4", "5"], { message: "Select an option" }),
    experienceComments: z.string().max(500, "Comment is too long").optional(),
    consentAccuracy: z.boolean().refine(Boolean, "Required"),
    consentCommunication: z.boolean().refine(Boolean, "Required"),
    consentMedia: z.boolean().refine(Boolean, "Required"),
    consentGuardian: z.boolean().optional(),
    interestedInMerch: z.enum(["Yes", "No"]).optional()
  })


  
  .superRefine((attendee, ctx) => {
    const attendeePhone = normalizePhone(attendee.phone);

    if (attendeePhone) {
      (["guardian", "emergencyContact", "authorizedPickup"] as const).forEach((key) => {
        const contactPhone = normalizePhone(attendee[key]?.phone);

        if (contactPhone && contactPhone === attendeePhone) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: DUPLICATE_PHONE_MESSAGE,
            path: [key, "phone", "number"]
          });
        }
      });
    }

    const age = calculateAge(attendee.dateOfBirth);

    if (age === null) return;

    if (age !== null && (age < 13 || age > 30)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateOfBirth"],
        message:
          "You have to be a teenager or young adult by STAR Camp to attend."
      });
    }

    if (age < 20) {
      const guardianCheck = requiredContactSchema.safeParse(attendee.guardian);

      if (!guardianCheck.success) {
        guardianCheck.error.issues.forEach((issue) => {
          ctx.addIssue({
            ...issue,
            path: ["guardian", ...issue.path]
          });
        });
      }

      if (attendee.pickupAuthority === "other") {
        const pickupCheck = requiredContactSchema.safeParse(attendee.authorizedPickup);

        if (!pickupCheck.success) {
          pickupCheck.error.issues.forEach((issue) => {
            ctx.addIssue({
              ...issue,
              path: ["authorizedPickup", ...issue.path]
            });
          });
        }
      }
    }

    if (age >= 20) {
      const emergencyCheck = requiredContactSchema.safeParse(attendee.emergencyContact);

      if (!emergencyCheck.success) {
        emergencyCheck.error.issues.forEach((issue) => {
          ctx.addIssue({
            ...issue,
            path: ["emergencyContact", ...issue.path]
          });
        });
      }
    }
  });

const sponsorshipRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .max(40, "Sponsorship code is too long")
    .optional()
    .or(z.literal("")),

  attendeeIndexes: z
    .array(z.number().int().min(0).max(9))
    .max(10)
    .default([])
});

export const registrationSchema = z.object({
  eventSlug: z.string().min(1, "Choose camp location"),
  ticketQuantity: z.coerce.number().min(1).max(10),
  buyer: z.object({
    fullName: z.string().min(2, "Buyer name is required"),
    email: z.string().email("Enter a valid email"),
    phone: phoneSchema
  }),
  attendees: z.array(attendeeSchema).min(1).max(10),
  sponsorship: sponsorshipRequestSchema.optional(),
  duplicateOverrideAttendeeIndexes: z.array(z.number()).optional()
})

.superRefine((data, ctx) => {
    const sponsorship = data.sponsorship;

    if (!sponsorship) {
      return;
    }

    const code =
      sponsorship.code?.trim() ?? "";

    const indexes =
      sponsorship.attendeeIndexes ?? [];

    /*
     * A submitted sponsorship code must actually be
     * attached to at least one attendee.
     */
    if (code && indexes.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [
          "sponsorship",
          "attendeeIndexes"
        ],
        message:
          "Select at least one attendee for this sponsorship."
      });
    }

    /*
     * Reject duplicate attendee indexes.
     */
    if (
      new Set(indexes).size !==
      indexes.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [
          "sponsorship",
          "attendeeIndexes"
        ],
        message:
          "The same attendee cannot be selected more than once."
      });
    }

    /*
     * Every selected attendee index must correspond
     * to a real attendee on this registration.
     */
    for (const index of indexes) {
      if (
        index < 0 ||
        index >= data.attendees.length
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [
            "sponsorship",
            "attendeeIndexes"
          ],
          message:
            "Invalid sponsored attendee selection."
        });

        break;
      }
    }
  });

export type RegistrationFormData = z.infer<typeof registrationSchema>;
