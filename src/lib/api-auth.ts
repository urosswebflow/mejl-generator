import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey);
}

export async function getUserFromRequest(
  request: NextRequest
): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return { user: null, error: "Supabase nije konfigurisan." };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return { user: null, error: "Niste prijavljeni." };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { user: null, error: "Neispravna ili istekla sesija." };
  }

  return { user: data.user, error: null };
}
