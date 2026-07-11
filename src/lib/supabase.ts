import { createClient } from "@supabase/supabase-js";

const REMEMBER_ME_KEY = "mejl-generator-remember-me";
const AUTH_KEY_PREFIX = "sb-";

function isRememberMeEnabled(): boolean {
  if (typeof window === "undefined") return true;

  return localStorage.getItem(REMEMBER_ME_KEY) !== "false";
}

export function setRememberMePreference(enabled: boolean): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(REMEMBER_ME_KEY, enabled ? "true" : "false");
}

export function getRememberMePreference(): boolean {
  return isRememberMeEnabled();
}

function getActiveStorage(): Storage {
  return isRememberMeEnabled() ? localStorage : sessionStorage;
}

const rememberMeStorage: Storage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;

    const active = getActiveStorage().getItem(key);
    if (active !== null) return active;

    const other = isRememberMeEnabled() ? sessionStorage : localStorage;
    return other.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;

    getActiveStorage().setItem(key, value);
  },
  removeItem(key: string): void {
    if (typeof window === "undefined") return;

    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
  get length(): number {
    return 0;
  },
  clear(): void {
    if (typeof window === "undefined") return;

    for (const storage of [localStorage, sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (key.startsWith(AUTH_KEY_PREFIX)) {
          storage.removeItem(key);
        }
      }
    }
  },
  key(): string | null {
    return null;
  },
};

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      storage: rememberMeStorage,
    },
  }
);
