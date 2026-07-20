import { supabase } from "@/lib/supabase";

export async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error("Niste prijavljeni.");
  }

  return data.session.access_token;
}

export async function authFetch(url: string, init?: RequestInit) {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);

  headers.set("Authorization", `Bearer ${token}`);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}
