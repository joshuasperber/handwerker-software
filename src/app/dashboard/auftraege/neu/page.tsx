"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ORDER_TYPE_LABELS } from "@/lib/inventory/formulas";
import { ChevronLeft, ChevronRight, Check, Plus, Trash2 } from "lucide-react";

interface CustomService {
  name: string;
  description: string;
  quantity: number;
  price: number | null;
  notes: string;
}

const STEPS = ["Typ", "Kunde", "Leistung", "Material", "Termin", "Freigabe"];

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  properties: {
    id: string;
    label: string;
    street: string;
    city: string;
    zipCode: string;
    isActive: boolean;
    isPrimary: boolean;
    travelZone: { id: string; name: string } | null;
  }[];
}

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
}

interface Employee {
  id: string;
  user: { firstName: string; lastName: string };
}

export default function NeuerAuftragPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [previewLines, setPreviewLines] = useState<{ name: string; quantityRequired: number; unit: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    orderType: "REPARATUR",
    title: "",
    description: "",
    customerId: "",
    propertyId: "",
    serviceIds: [] as string[],
    customServices: [] as CustomService[],
    employeeId: "",
    scheduledStart: "",
    scheduledEnd: "",
    confirmMaterial: false,
    newCustomer: { firstName: "", lastName: "", email: "", phone: "", street: "", zipCode: "", city: "" },
    createNewCustomer: false,
  });

  useEffect(() => {
    fetch("/api/customers").then((r) => r.json()).then((d) => { if (d.success) setCustomers(d.data); });
    fetch("/api/services").then((r) => r.json()).then((d) => { if (d.success) setServices(d.data); });
    fetch("/api/employees").then((r) => r.json()).then((d) => { if (d.success) setEmployees(d.data); });
  }, []);

  useEffect(() => {
    if (step === 3 && form.serviceIds.length) {
      fetch("/api/services")
        .then((r) => r.json())
        .then(async () => {
          const res = await fetch(`/api/services?includeMaterials=1`).catch(() => null);
          if (!res) return;
          const all = await fetch("/api/services").then((r) => r.json());
          if (!all.success) return;
          const lines: { name: string; quantityRequired: number; unit: string }[] = [];
          for (const sid of form.serviceIds) {
            const matRes = await fetch(`/api/services/${sid}/material-template`);
            const mat = await matRes.json();
            if (mat.success) lines.push(...mat.data.map((m: { name: string; defaultQuantity: number; unit: string }) => ({
              name: m.name,
              quantityRequired: m.defaultQuantity,
              unit: m.unit,
            })));
          }
          setPreviewLines(lines);
        });
    }
  }, [step, form.serviceIds]);

  async function ensureCustomer(): Promise<{ customerId: string; propertyId: string } | null> {
    if (form.createNewCustomer) {
      const nc = form.newCustomer;
      if (!nc.firstName || !nc.lastName || !nc.street || !nc.zipCode || !nc.city) {
        setError("Bitte alle Pflichtfelder für den neuen Kunden ausfüllen.");
        return null;
      }
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: nc.firstName,
          lastName: nc.lastName,
          email: nc.email || undefined,
          phone: nc.phone,
          property: { street: nc.street, zipCode: nc.zipCode, city: nc.city, label: "Einsatzort" },
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Kunde konnte nicht angelegt werden"); return null; }
      return { customerId: data.data.id, propertyId: data.data.properties[0].id };
    }
    if (!form.customerId || !form.propertyId) {
      setError("Bitte Kunde und Einsatzort wählen.");
      return null;
    }
    return { customerId: form.customerId, propertyId: form.propertyId };
  }

  async function submit() {
    setSaving(true);
    setError("");
    const ids = await ensureCustomer();
    if (!ids) { setSaving(false); return; }

    const res = await fetch("/api/orders/wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...ids,
        title: form.title || ORDER_TYPE_LABELS[form.orderType],
        orderType: form.orderType,
        description: form.description,
        serviceIds: form.serviceIds,
        customServices: form.customServices
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name,
            description: c.description || undefined,
            quantity: c.quantity,
            unitPriceCents: c.price != null ? Math.round(c.price * 100) : undefined,
            notes: c.notes || undefined,
          })),
        employeeId: form.employeeId || undefined,
        scheduledStart: form.scheduledStart || undefined,
        scheduledEnd: form.scheduledEnd || undefined,
        confirmMaterial: form.confirmMaterial,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      router.push(`/dashboard/auftraege/${data.data.id}`);
    } else {
      setError(data.error ?? "Auftrag konnte nicht angelegt werden");
    }
  }

  function toggleService(id: string) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((x) => x !== id) : [...f.serviceIds, id],
    }));
  }

  function addCustomService() {
    setForm((f) => ({
      ...f,
      customServices: [...f.customServices, { name: "", description: "", quantity: 1, price: null, notes: "" }],
    }));
  }

  function updateCustomService(index: number, patch: Partial<CustomService>) {
    setForm((f) => ({
      ...f,
      customServices: f.customServices.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function removeCustomService(index: number) {
    setForm((f) => ({ ...f, customServices: f.customServices.filter((_, i) => i !== index) }));
  }

  const hasCustomService = form.customServices.some((c) => c.name.trim());
  const selectedCustomer = customers.find((c) => c.id === form.customerId);

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/dashboard/auftraege" className="text-sm text-[#0d5c63] flex items-center gap-1 mb-4">
        <ChevronLeft className="h-4 w-4" /> Zurück zu Aufträgen
      </Link>

      <h1 className="text-2xl font-bold mb-2">Neuer Auftrag</h1>
      <p className="text-slate-500 text-sm mb-6">Assistent: Typ → Kunde → Leistung → Material → Termin → Freigabe</p>

      <div className="flex gap-1 overflow-x-auto mb-6 pb-1">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              i === step ? "bg-[#0d5c63] text-white ring-2 ring-[#0d5c63]/30" : "bg-slate-100 text-slate-600 hover:bg-[#0d5c63]/10 hover:text-[#0d5c63]"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {step === 0 && (
        <Card title="Auftragstyp">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Typ *</label>
              <select
                className="w-full h-10 rounded-lg border mt-1 px-3 text-sm"
                value={form.orderType}
                onChange={(e) => setForm({ ...form, orderType: e.target.value })}
              >
                {Object.entries(ORDER_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <Input label="Auftragstitel *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z. B. Tür montieren Müller" />
            <Textarea label="Beschreibung" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card title="Kunde & Einsatzort">
          <label className="flex items-center gap-2 text-sm mb-4">
            <input type="checkbox" checked={form.createNewCustomer} onChange={(e) => setForm({ ...form, createNewCustomer: e.target.checked })} />
            Neuen Kunden anlegen
          </label>
          {form.createNewCustomer ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Vorname *" value={form.newCustomer.firstName} onChange={(e) => setForm({ ...form, newCustomer: { ...form.newCustomer, firstName: e.target.value } })} />
              <Input label="Nachname *" value={form.newCustomer.lastName} onChange={(e) => setForm({ ...form, newCustomer: { ...form.newCustomer, lastName: e.target.value } })} />
              <Input label="E-Mail" type="email" value={form.newCustomer.email} onChange={(e) => setForm({ ...form, newCustomer: { ...form.newCustomer, email: e.target.value } })} />
              <Input label="Telefon" value={form.newCustomer.phone} onChange={(e) => setForm({ ...form, newCustomer: { ...form.newCustomer, phone: e.target.value } })} />
              <Input label="Straße *" value={form.newCustomer.street} onChange={(e) => setForm({ ...form, newCustomer: { ...form.newCustomer, street: e.target.value } })} />
              <Input label="PLZ *" value={form.newCustomer.zipCode} onChange={(e) => setForm({ ...form, newCustomer: { ...form.newCustomer, zipCode: e.target.value } })} />
              <Input label="Ort *" value={form.newCustomer.city} onChange={(e) => setForm({ ...form, newCustomer: { ...form.newCustomer, city: e.target.value } })} />
            </div>
          ) : (
            <>
              <select
                className="w-full h-10 rounded-lg border px-3 text-sm mb-3"
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value, propertyId: "" })}
              >
                <option value="">Kunde wählen...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
              {selectedCustomer && (
                <>
                  <select
                    className="w-full h-10 rounded-lg border px-3 text-sm"
                    value={form.propertyId}
                    onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
                  >
                    <option value="">Standort / Einsatzort wählen...</option>
                    {selectedCustomer.properties.filter((p) => p.isActive).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}: {p.street}, {p.city}
                        {p.travelZone ? ` · Zone: ${p.travelZone.name}` : " · keine Zone"}
                      </option>
                    ))}
                  </select>
                  {form.propertyId && (() => {
                    const sel = selectedCustomer.properties.find((p) => p.id === form.propertyId);
                    if (sel && !sel.travelZone) {
                      return (
                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                          Diesem Standort ist keine Anfahrtszone zugeordnet. Die Anfahrtskosten können dann nicht automatisch berechnet werden – bitte zuerst beim Kunden eine Zone zuweisen.
                        </p>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
            </>
          )}
        </Card>
      )}

      {step === 2 && (
        <Card title="Leistungen wählen">
          <p className="text-sm text-slate-500 mb-4">Aus dem Leistungsverzeichnis – erzeugt automatisch Phasen und Materialvorschlag.</p>
          <div className="space-y-2">
            {services.map((s) => (
              <label key={s.id} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer ${form.serviceIds.includes(s.id) ? "border-[#0d5c63] bg-[#0d5c63]/5" : "border-slate-200"}`}>
                <input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} />
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.durationMinutes} Min.</p>
                </div>
              </label>
            ))}
            {!services.length && (
              <p className="text-sm text-slate-400">Noch keine Leistungen im Verzeichnis – nutzen Sie unten „Sonstige Leistung“.</p>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-sm">Sonstige Leistung</p>
                <p className="text-xs text-slate-500">Nicht im Verzeichnis? Hier frei erfassen – wird in Angebot/Rechnung übernommen.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addCustomService}>
                <Plus className="h-4 w-4 mr-1" /> Hinzufügen
              </Button>
            </div>

            <div className="space-y-3">
              {form.customServices.map((c, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <Input
                      label="Bezeichnung *"
                      className="flex-1"
                      value={c.name}
                      onChange={(e) => updateCustomService(i, { name: e.target.value })}
                      placeholder="z. B. Sonderanfertigung Blende"
                    />
                    <button type="button" onClick={() => removeCustomService(i)} className="text-red-500 mt-7 shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea
                    label="Beschreibung (optional)"
                    value={c.description}
                    onChange={(e) => updateCustomService(i, { description: e.target.value })}
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput
                      label="Menge"
                      allowDecimal={false}
                      min={1}
                      value={c.quantity}
                      onValueChange={(v) => updateCustomService(i, { quantity: v ?? 1 })}
                    />
                    <NumberInput
                      label="Preis (netto, optional)"
                      suffix="€"
                      value={c.price}
                      onValueChange={(v) => updateCustomService(i, { price: v })}
                      placeholder="z. B. 120"
                    />
                  </div>
                  <Input
                    label="Interne Notiz (optional)"
                    value={c.notes}
                    onChange={(e) => updateCustomService(i, { notes: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card title="Material prüfen">
          <p className="text-sm text-slate-500 mb-4">Vorschlag aus Leistungsverzeichnis. Reservierung erfolgt erst nach Freigabe in Schritt 6.</p>
          {previewLines.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">Keine Materialvorlagen für gewählte Leistungen – bitte im Leistungsverzeichnis pflegen oder später manuell ergänzen.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {previewLines.map((l, i) => (
                <li key={i} className="py-2 flex justify-between text-sm">
                  <span>{l.name}</span>
                  <span className="text-slate-500">{l.quantityRequired} {l.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {step === 4 && (
        <Card title="Termin & Mitarbeiter (optional)">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Monteur</label>
              <select className="w-full h-10 rounded-lg border mt-1 px-3 text-sm" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                <option value="">Später zuweisen</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.user.firstName} {e.user.lastName}</option>
                ))}
              </select>
            </div>
            <Input label="Beginn" type="datetime-local" value={form.scheduledStart} onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} />
            <Input label="Ende" type="datetime-local" value={form.scheduledEnd} onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })} />
          </div>
        </Card>
      )}

      {step === 5 && (
        <Card title="Freigabe">
          <ul className="text-sm space-y-2 mb-4">
            <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> {ORDER_TYPE_LABELS[form.orderType]}</li>
            <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> {form.title || "—"}</li>
            <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> {form.serviceIds.length + form.customServices.filter((c) => c.name.trim()).length} Leistung(en){hasCustomService ? ` (inkl. ${form.customServices.filter((c) => c.name.trim()).length} sonstige)` : ""}</li>
            <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> Phasen werden automatisch erzeugt</li>
          </ul>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.confirmMaterial} onChange={(e) => setForm({ ...form, confirmMaterial: e.target.checked })} />
            <span>Material jetzt reservieren (nur wenn Bestand im Hauptlager vorhanden)</span>
          </label>
          <Button className="mt-6 w-full" variant="action" onClick={submit} disabled={saving}>
            {saving ? "Wird angelegt..." : "Auftrag anlegen"}
          </Button>
        </Card>
      )}

      <div className="flex justify-between mt-6">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ChevronLeft className="h-4 w-4" /> Zurück
        </Button>
        {step < STEPS.length - 1 && (
          <Button
            variant="outline"
            onClick={() => {
              setError("");
              if (step === 0 && !form.title) { setError("Bitte Auftragstitel eingeben."); return; }
              if (step === 2 && !form.serviceIds.length && !hasCustomService) { setError("Bitte mindestens eine Leistung wählen oder eine sonstige Leistung erfassen."); return; }
              setStep((s) => s + 1);
            }}
          >
            Weiter <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
