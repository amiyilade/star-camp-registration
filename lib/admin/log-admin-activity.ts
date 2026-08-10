import { supabaseAdmin } from "@/lib/supabase/server";

type AdminActivityAction =
  | "badge_marked_printed"
  | "badge_marked_issued"
  | "ticket_resent"
  | "ticket_resend_failed"
  | "admin_created"
  | "admin_updated"
  | "admin_role_updated"
  | "admin_access_denied"
  | "event_admin_added"
  | "event_admin_role_changed"
  | "event_admin_removed"
  | "super_admin_status_changed"
  | "order_fulfillment_repaired"
  | "order_fulfillment_failed"
  | "tickets_generated"
  | "ticket_email_failed"
  | "payment_settings_updated"
  | "sponsorship_campaign_created"
  | "sponsorship_campaign_updated"
  | "sponsorship_code_created"
  | "sponsorship_code_updated"
  | "sponsorship_email_added"
  | "sponsorship_email_removed";

type AdminActivityOutcome =
  | "success"
  | "failure"
  | "denied";

type LogAdminActivityInput = {
  adminUserId?: string | null;
  adminEmail: string;

  eventId?: string | null;
  ticketId?: string | null;
  attendeeId?: string | null;

  action: AdminActivityAction;
  outcome?: AdminActivityOutcome;

  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAdminActivity({
  adminUserId = null,
  adminEmail,
  eventId = null,
  ticketId = null,
  attendeeId = null,
  action,
  outcome = "success",
  notes = null,
  metadata = {}
}: LogAdminActivityInput) {
  const { error } = await supabaseAdmin
    .from("admin_activity_logs")
    .insert({
      admin_user_id: adminUserId,
      admin_email: adminEmail,
      event_id: eventId,
      ticket_id: ticketId,
      attendee_id: attendeeId,
      action,
      outcome,
      notes,
      metadata
    });

  if (error) {
    console.error("Could not persist admin activity log:", {
      action,
      adminUserId,
      adminEmail,
      eventId,
      ticketId,
      attendeeId,
      error
    });
  }
}