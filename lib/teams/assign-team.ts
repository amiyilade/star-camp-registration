import { supabaseAdmin } from "@/lib/supabase/server";

export async function assignTeam(ticketId: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "assign_team_to_ticket",
    {
      p_ticket_id: ticketId
    }
  );

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}