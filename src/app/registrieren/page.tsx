"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";
import { Wrench } from "lucide-react";

export default function RegistrierenPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    slug: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetchJson<{ slug: string; redirectTo: string }>(
      "/api/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          slug: form.slug || undefined,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
        }),
      }
    );
    setLoading(false);
    if (!res.success) {
      setError(res.error ?? "Registrierung fehlgeschlagen");
      return;
    }
    router.push(res.data?.redirectTo ?? "/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0d5c63] text-white">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">JoMaster starten</h1>
            <p className="text-sm text-slate-500">Leerer Workspace für deinen Betrieb</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            label="Betriebsname"
            required
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          />
          <Input
            label="Kürzel (optional, für Buchungs-Link)"
            placeholder="mein-betrieb"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Vorname"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
            <Input
              label="Nachname"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
          <Input
            label="Admin-E-Mail"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Passwort"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Wird angelegt…" : "Betrieb anlegen"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Schon registriert?{" "}
          <Link href="/login" className="text-[#0d5c63] font-medium hover:underline">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
