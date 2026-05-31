import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase/server";

export async function getAdminUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {}
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const { data: adminUser } = await supabaseAdmin
    .from("admin_users")
    .select("*")
    .eq("email", user.email)
    .eq("is_active", true)
    .single();

  return adminUser;
}