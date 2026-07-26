"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function PasswortVergessenPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Anfrage fehlgeschlagen");
      } else {
        setDone(true);
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md space-y-4 !p-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Passwort vergessen</h1>
          <p className="mt-1 text-sm text-slate-600">
            Wir senden dir einen Link zum Zurücksetzen per E-Mail.
          </p>
        </div>

        {done ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Wenn ein Konto mit dieser Adresse existiert, wurde eine E-Mail
              gesendet. Bitte Posteingang und Spam prüfen.
            </p>
            <Link href="/login" className="text-sm font-medium text-[#0d5c63] hover:underline">
              Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="E-Mail"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Senden…" : "Link senden"}
            </Button>
            <p className="text-center text-sm text-slate-600">
              <Link href="/login" className="text-[#0d5c63] font-medium hover:underline">
                Zurück zur Anmeldung
              </Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
