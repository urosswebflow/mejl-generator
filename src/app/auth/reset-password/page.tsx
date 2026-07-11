"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setRememberMePreference, supabase } from "@/lib/supabase";

function withTimeout<T>(promise: PromiseLike<T>, ms = 10000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), ms)
    ),
  ]);
}

function requestErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "Request timeout") {
    return "Zahtev je istekao. Pokušajte ponovo.";
  }

  if (error instanceof Error) return error.message;

  return "Došlo je do greške.";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function initRecoverySession() {
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession());

        if (!active) return;

        if (error) {
          setMessage(error.message);
          return;
        }

        if (data.session) {
          setReady(true);
          return;
        }

        setMessage(
          "Link za promenu lozinke nije validan ili je istekao. Zatražite novi link sa stranice za prijavu."
        );
      } catch (error) {
        if (!active) return;
        setMessage(requestErrorMessage(error));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setMessage("");
        setLoading(false);
      }
    });

    void initRecoverySession();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit() {
    if (!newPassword || !confirmPassword) {
      setMessage("Popunite oba polja za lozinku.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Lozinke se ne poklapaju.");
      return;
    }

    if (newPassword.length < 6) {
      setMessage("Lozinka mora imati najmanje 6 karaktera.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const { error } = await withTimeout(
        supabase.auth.updateUser({
          password: newPassword,
        })
      );

      if (error) {
        setMessage(error.message);
        return;
      }

      setRememberMePreference(true);
      setMessage("Lozinka je uspešno promenjena. Preusmeravamo vas na prijavu...");
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (error) {
      setMessage(requestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0f1115] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#1a1d24] border border-[#2a2f3a] rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">
          Nova lozinka
        </h1>

        <p className="text-gray-400 text-center mb-8">
          Unesite novu lozinku za vaš nalog.
        </p>

        {loading ? (
          <p className="text-center text-gray-300">Učitavanje...</p>
        ) : ready ? (
          <div className="space-y-4">
            <input
              type="password"
              placeholder="Nova lozinka"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[#11141a] border border-[#2a2f3a] rounded-xl px-4 py-3 text-white outline-none"
            />

            <input
              type="password"
              placeholder="Potvrdite lozinku"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#11141a] border border-[#2a2f3a] rounded-xl px-4 py-3 text-white outline-none"
            />

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 transition rounded-xl py-3 text-white font-semibold disabled:opacity-60"
            >
              {submitting ? "Molimo sačekajte..." : "Sačuvaj novu lozinku"}
            </button>
          </div>
        ) : null}

        {message && (
          <div className="mt-4 text-sm text-center text-gray-300">{message}</div>
        )}

        <Link
          href="/"
          className="mt-6 block w-full text-center text-sm text-gray-400 hover:text-white transition"
        >
          Nazad na prijavu
        </Link>
      </div>
    </main>
  );
}
