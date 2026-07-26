"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function PasswortSetzenPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError && !cancelled) {
            setError(exchangeError.message);
            return;
          }
          // Clean URL
          window.history.replaceState({}, "", "/passwort-setzen");
        }
        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          setReady(Boolean(data.session));
          if (!data.session) {
            setError(
              "Reset-Link ungültig oder abgelaufen. Bitte erneut „Passwort vergessen“ nutzen."
            );
          }
        }
      } catch {
        if (!cancelled) {
          setError("Supabase ist nicht konfiguriert.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Passwort mindestens 8 Zeichen");
      return;
    }
    if (password !== password2) {
      setError("Passwörter stimmen nicht überein");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      await supabase.auth.signOut();
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md space-y-4 !p-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Neues Passwort</h1>
          <p className="mt-1 text-sm text-slate-600">
            Vergib ein neues Passwort für dein JoMaster-Konto.
          </p>
        </div>

        {done ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Passwort gespeichert. Weiter zur Anmeldung…
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Neues Passwort"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!ready}
            />
            <Input
              label="Passwort wiederholen"
              type="password"
              required
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              disabled={!ready}
            />
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !ready}>
              {loading ? "Speichern…" : "Passwort speichern"}
            </Button>
            <p className="text-center text-sm text-slate-600">
              <Link href="/passwort-vergessen" className="text-[#0d5c63] font-medium hover:underline">
                Neuen Link anfordern
              </Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
