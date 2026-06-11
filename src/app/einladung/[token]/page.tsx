"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { fetchJson } from "@/lib/fetch-json";
import { ROLE_LABELS } from "@/lib/utils";
import { Wrench, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface InvitationInfo {
  email: string;
  role: string;
  companyName: string;
  message: string | null;
}

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", password: "", password2: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchJson<InvitationInfo>(`/api/invitations/accept?token=${encodeURIComponent(token)}`).then((d) => {
      if (d.success && d.data) setInfo(d.data);
      else setLoadError(d.error ?? "Einladung ungültig");
    });
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    if (form.password !== form.password2) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.success) {
      router.push(data.data.redirectTo ?? "/portal");
    } else {
      setError(data.error ?? "Annahme fehlgeschlagen");
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900">Einladung nicht verfügbar</h1>
          <p className="text-slate-600 mt-2">{loadError}</p>
          <p className="text-sm text-slate-400 mt-4">
            Bitte wenden Sie sich an den Absender für eine neue Einladung.
          </p>
        </Card>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#0d5c63]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0d5c63] text-white mb-4">
            <Wrench className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 text-center">{info.companyName}</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            Sie wurden eingeladen · {ROLE_LABELS[info.role] ?? info.role}
          </p>
        </div>

        {info.message && (
          <div className="mb-4 rounded-lg bg-[#0d5c63]/5 border border-[#0d5c63]/15 p-3 text-sm text-slate-700">
            <p className="font-medium text-[#0d5c63] mb-1">Persönliche Nachricht</p>
            {info.message}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <Input label="E-Mail" type="email" value={info.email} disabled />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Vorname" value={form.firstName} required
              onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Nachname" value={form.lastName} required
              onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <Input label="Passwort (min. 8 Zeichen)" type="password" value={form.password} required
            autoComplete="new-password"
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Input label="Passwort wiederholen" type="password" value={form.password2} required
            autoComplete="new-password"
            onChange={(e) => setForm({ ...form, password2: e.target.value })} />

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <Button type="submit" variant="action" className="w-full" disabled={submitting}>
            {submitting ? "Wird eingerichtet..." : (<><CheckCircle className="h-4 w-4 mr-1" /> Einladung annehmen</>)}
          </Button>
        </form>
      </Card>
    </div>
  );
}
