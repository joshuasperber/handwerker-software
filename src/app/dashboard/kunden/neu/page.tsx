"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveJson } from "@/lib/save-toast";
import { cn } from "@/lib/utils";
import { Building2, ChevronLeft, User } from "lucide-react";

interface Zone { id: string; name: string; isActive: boolean }

type CustomerKind = "PRIVAT" | "GEWERBLICH";

export default function NeuerKundePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType: CustomerKind =
    searchParams.get("type") === "business" || searchParams.get("type") === "GEWERBLICH"
      ? "GEWERBLICH"
      : "PRIVAT";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    customerType: initialType as CustomerKind,
    contactPerson: "",
    vatId: "",
    taxNumber: "",
    taxNotes: "",
    street: "",
    zipCode: "",
    city: "",
    propertyLabel: "Hauptadresse",
    travelZoneId: "",
    notes: "",
  });

  useEffect(() => {
    fetch("/api/travel-zones").then((r) => r.json()).then((d) => { if (d.success) setZones(d.data); });
  }, []);

  const isBusiness = form.customerType === "GEWERBLICH";

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
          customerType: form.customerType,
          contactPerson: form.contactPerson || undefined,
          vatId: form.vatId || undefined,
          taxNumber: form.taxNumber || undefined,
          taxNotes: form.taxNotes || undefined,
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
      { success: isBusiness ? "Business-Kunde angelegt" : "Kunde angelegt", error: "Fehler beim Anlegen" }
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
      <h1 className="text-2xl font-bold mb-6">
        {isBusiness ? "Neuer Business-Kunde" : "Neuer Privatkunde"}
      </h1>
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <form onSubmit={submit}>
        <Card title="Kundenart" className="mb-6">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, customerType: "PRIVAT" })}
              className={cn(
                "flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition-colors",
                !isBusiness
                  ? "border-[#0d5c63] bg-[#0d5c63]/5 ring-2 ring-[#0d5c63]/20"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4" /> Privatkunde
              </span>
              <span className="text-xs text-slate-500">Privatperson · Rechnung mit USt</span>
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, customerType: "GEWERBLICH" })}
              className={cn(
                "flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition-colors",
                isBusiness
                  ? "border-[#0d5c63] bg-[#0d5c63]/5 ring-2 ring-[#0d5c63]/20"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4" /> Business-Kunde
              </span>
              <span className="text-xs text-slate-500">Unternehmen · ggf. Reverse-Charge</span>
            </button>
          </div>
          {isBusiness && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-medium">Steuerhinweis</p>
              <p className="mt-1">
                Business-Kunden bleiben umsatzsteuerpflichtig, solange Sie in der Kalkulation
                „Standard“ wählen. Mit gültiger USt-IdNr. schlägt die App bei der Kalkulation
                Reverse-Charge (§ 13b) vor — dann steht auf der Rechnung 0 % USt (netto). Bitte
                steuerlich prüfen und in „Steuer & Ergebnis“ bestätigen.
              </p>
            </div>
          )}
        </Card>

        <Card title="Stammdaten" className="mb-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {isBusiness && (
              <Input
                label="Firmenname *"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="sm:col-span-2"
                required
              />
            )}
            <Input
              label={isBusiness ? "Ansprechpartner Vorname *" : "Vorname *"}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
            <Input
              label={isBusiness ? "Ansprechpartner Nachname *" : "Nachname *"}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
            <Input label="E-Mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            {isBusiness ? (
              <>
                <Input
                  label="USt-IdNr."
                  value={form.vatId}
                  onChange={(e) => setForm({ ...form, vatId: e.target.value })}
                  placeholder="z. B. DE123456789"
                />
                <Input
                  label="Steuernummer"
                  value={form.taxNumber}
                  onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                />
                <Input
                  label="Weitere Ansprechpartner (optional)"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  className="sm:col-span-2"
                />
                <Textarea
                  label="Hinweise zur steuerlichen Behandlung"
                  value={form.taxNotes}
                  onChange={(e) => setForm({ ...form, taxNotes: e.target.value })}
                  rows={2}
                  className="sm:col-span-2"
                  placeholder="z. B. immer Reverse-Charge / Bauleistungen …"
                />
              </>
            ) : (
              <Input
                label="Firma (optional)"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="sm:col-span-2"
              />
            )}
            <Textarea
              label="Notizen"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="sm:col-span-2"
            />
          </div>
        </Card>

        <Card title="Hauptadresse">
          <p className="text-sm text-slate-500 mb-3">
            Bei der Erstanlage wird nur die Hauptadresse erfasst. Weitere Adressen können später
            beim Bearbeiten des Kunden hinzugefügt werden.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Bezeichnung" value={form.propertyLabel} onChange={(e) => setForm({ ...form, propertyLabel: e.target.value })} />
            <div>
              <label className="text-sm font-medium">Fahrzone</label>
              <select
                className="mt-1 h-10 w-full rounded-2xl border border-slate-300 px-3 text-sm"
                value={form.travelZoneId}
                onChange={(e) => setForm({ ...form, travelZoneId: e.target.value })}
              >
                <option value="">Keine Zone</option>
                {zones.filter((z) => z.isActive).map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
            <Input label="Straße" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} className="sm:col-span-2" />
            <Input label="PLZ" value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
            <Input label="Ort" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <Button type="submit" variant="action" className="mt-4" disabled={saving}>
            {saving ? "Wird angelegt …" : isBusiness ? "Business-Kunde anlegen" : "Kunde anlegen"}
          </Button>
        </Card>
      </form>
    </div>
  );
}
