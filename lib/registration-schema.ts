import { z } from "zod";

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
    const age = calculateAge(attendee.dateOfBirth);

    if (age === null) return;

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

export const registrationSchema = z.object({
  eventSlug: z.string().min(1, "Choose camp location"),
  ticketQuantity: z.coerce.number().min(1).max(10),
  buyer: z.object({
    fullName: z.string().min(2, "Buyer name is required"),
    email: z.string().email("Enter a valid email"),
    phone: phoneSchema
  }),
  attendees: z.array(attendeeSchema).min(1).max(10)
});

export type RegistrationFormData = z.infer<typeof registrationSchema>;
