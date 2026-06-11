"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveJson } from "@/lib/save-toast";
import { ChevronLeft } from "lucide-react";

interface Zone { id: string; name: string; isActive: boolean }

export default function NeuerKundePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
    street: "",
    zipCode: "",
    city: "",
    propertyLabel: "Hauptadresse",
    travelZoneId: "",
  });

  useEffect(() => {
    fetch("/api/travel-zones").then((r) => r.json()).then((d) => { if (d.success) setZones(d.data); });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const data = await saveJson<{ id: string }>(
      "/api/customers",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || undefined,
          phone: form.phone || undefined,
          company: form.company || undefined,
          notes: form.notes || undefined,
          property: form.street
            ? {
                label: form.propertyLabel,
                street: form.street,
                zipCode: form.zipCode,
                city: form.city,
                travelZoneId: form.travelZoneId || undefined,
              }
            : undefined,
        }),
      },
      { success: "Kunde angelegt", error: "Fehler beim Anlegen" }
    );
    setSaving(false);
    if (data.success && data.data) router.push(`/dashboard/kunden/${data.data.id}`);
    else setError(data.error ?? "Fehler beim Anlegen");
  }

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/kunden" className="text-sm text-[#0d5c63] flex items-center gap-1 mb-4 hover:underline">
        <ChevronLeft className="h-4 w-4" /> Zurück zu Kunden
      </Link>
      <h1 className="text-2xl font-bold mb-6">Neuer Kunde</h1>
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <form onSubmit={submit}>
        <Card title="Stammdaten" className="mb-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Vorname *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            <Input label="Nachname *" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            <Input label="E-Mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Firma" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="sm:col-span-2" />
            <Textarea label="Notizen" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="sm:col-span-2" />
          </div>
        </Card>
        <Card title="Hauptadresse">
          <p className="text-sm text-slate-500 mb-3">
            Bei der Erstanlage wird nur die Hauptadresse erfasst. Weitere Adressen / Standorte können später beim Bearbeiten des Kunden hinzugefügt werden.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Bezeichnung" value={form.propertyLabel} onChange={(e) => setForm({ ...form, propertyLabel: e.target.value })} />
            <Input label="Straße" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
            <Input label="PLZ" value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
            <Input label="Ort" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Anfahrtszone (optional)</label>
              <select
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-sm mt-1"
                value={form.travelZoneId}
                onChange={(e) => setForm({ ...form, travelZoneId: e.target.value })}
              >
                <option value="">Keine Zone</option>
                {zones.filter((z) => z.isActive).map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>
        <Button type="submit" className="mt-6" variant="action" disabled={saving}>
          {saving ? "Wird gespeichert..." : "Kunde anlegen"}
        </Button>
      </form>
    </div>
  );
}
