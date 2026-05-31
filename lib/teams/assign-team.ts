import { supabaseAdmin } from "@/lib/supabase/server";

export async function assignTeam(ticketId: string, eventId: string) {
  const { data: existingTicket } = await supabaseAdmin
    .from("tickets")
    .select("assigned_team_id")
    .eq("id", ticketId)
    .single();

  if (existingTicket?.assigned_team_id) {
    return existingTicket.assigned_team_id;
  }

  const { data: teams } = await supabaseAdmin
    .from("teams")
    .select("id, code")
    .eq("event_id", eventId)
    .order("code");

  if (!teams?.length) {
    throw new Error("No teams configured.");
  }

  let selectedTeam = teams[0];
  let smallestCount = Number.MAX_SAFE_INTEGER;

  for (const team of teams) {
    const { count } = await supabaseAdmin
      .from("tickets")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("assigned_team_id", team.id);

    if ((count ?? 0) < smallestCount) {
      smallestCount = count ?? 0;
      selectedTeam = team;
    }
  }

  await supabaseAdmin
    .from("tickets")
    .update({
      assigned_team_id: selectedTeam.id
    })
    .eq("id", ticketId);

  return selectedTeam.id;
}