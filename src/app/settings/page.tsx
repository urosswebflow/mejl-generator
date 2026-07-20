"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";

type SenderEmail = {
  id: string;
  email: string;
  created_at: string;
};

export default function SettingsPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emails, setEmails] = useState<SenderEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  async function loadEmails() {
    setListLoading(true);

    try {
      const response = await authFetch("/api/sender-emails");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Greška pri učitavanju mejlova.");
      }

      setEmails(data.emails || []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Greška pri učitavanju mejlova."
      );
      setEmails([]);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setIsAuthenticated(false);
        setAuthLoading(false);
        setListLoading(false);
        return;
      }

      setIsAuthenticated(true);
      await loadEmails();
      setAuthLoading(false);
    }

    void init();
  }, []);

  async function addEmail() {
    setMessage("");
    setLoading(true);

    try {
      const response = await authFetch("/api/sender-emails", {
        method: "POST",
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Greška pri dodavanju mejla.");
      }

      setEmails((prev) => [...prev, data.email]);
      setNewEmail("");
      setMessage("Email je uspešno dodat.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Greška pri dodavanju mejla."
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeEmail(id: string) {
    setMessage("");
    setLoading(true);

    try {
      const response = await authFetch("/api/sender-emails", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Greška pri brisanju mejla.");
      }

      setEmails((prev) => prev.filter((item) => item.id !== id));
      setMessage("Email je uklonjen.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Greška pri brisanju mejla."
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p>Učitavanje...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Mejlovi za slanje</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Dodaj email adrese sa kojih šalješ propozale. Svaki mejl mora biti
              verifikovan u Resend-u (opcija A).
            </p>
          </div>

          <Link
            href="/"
            className="shrink-0 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-700"
          >
            Nazad
          </Link>
        </div>

        {!isAuthenticated ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <p className="text-zinc-300">Morate biti prijavljeni.</p>
            <Link
              href="/"
              className="mt-4 inline-flex rounded-xl bg-white px-4 py-3 font-semibold text-black"
            >
              Idi na prijavu
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Dodaj novi mejl</h2>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="npr. uros@tvojdomen.com"
                  className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-500"
                />

                <button
                  type="button"
                  onClick={addEmail}
                  disabled={loading || !newEmail.trim()}
                  className="rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Add new email
                </button>
              </div>

              {message && (
                <p className="mt-4 text-sm text-zinc-300">{message}</p>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Lista mejlova</h2>

              {listLoading ? (
                <p className="mt-4 text-sm text-zinc-400">Učitavanje...</p>
              ) : emails.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-400">
                  Još nema dodatih mejlova. Dodaj bar jedan da bi mogao da šalješ
                  propozale.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {emails.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {item.email}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeEmail(item.id)}
                        disabled={loading}
                        className="shrink-0 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300 transition hover:bg-red-900 disabled:opacity-50"
                      >
                        Obriši
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
