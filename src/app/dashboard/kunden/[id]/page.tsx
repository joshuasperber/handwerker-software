"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, MapPin, Mail, Phone, Trash2, Star, Pencil, Plus, X, Check } from "lucide-react";

interface Zone {
  id: string;
  name: string;
  flatFeeNet: number;
  useFormula: boolean;
  isActive: boolean;
}

interface Property {
  id: string;
  label: string;
  street: string;
  zipCode: string;
  city: string;
  notes: string | null;
  isPrimary: boolean;
  isActive: boolean;
  travelZoneId: string | null;
  travelZone: Zone | null;
}

interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  notes: string | null;
  properties: Property[];
  orders: { id: string; orderNumber: string; status: string; createdAt: string }[];
}

const EMPTY_PROP = { label: "", street: "", zipCode: "", city: "", notes: "", travelZoneId: "" };

export default function KundeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "", notes: "" });
  const [addingProperty, setAddingProperty] = useState(false);
  const [propertyForm, setPropertyForm] = useState({ ...EMPTY_PROP, label: "Weiterer Standort" });
  const [editPropId, setEditPropId] = useState<string | null>(null);
  const [editProp, setEditProp] = useState({ ...EMPTY_PROP });
  const [propError, setPropError] = useState("");

  function load() {
    fetch(`/api/customers/${id}`).then((r) => r.json()).then((d) => {
      if (d.success) {
        setCustomer(d.data);
        setForm({
          firstName: d.data.firstName,
          lastName: d.data.lastName,
          email: d.data.email,
          phone: d.data.phone ?? "",
          company: d.data.company ?? "",
          notes: d.data.notes ?? "",
        });
      }
    });
  }

  useEffect(() => {
    load();
    fetch("/api/travel-zones").then((r) => r.json()).then((d) => { if (d.success) setZones(d.data); });
  }, [id]);

  const activeZones = zones.filter((z) => z.isActive);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    load();
  }

  async function addProperty(e: React.FormEvent) {
    e.preventDefault();
    setPropError("");
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: id,
        ...propertyForm,
        travelZoneId: propertyForm.travelZoneId || null,
      }),
    });
    const d = await res.json();
    if (!d.success) { setPropError(d.error ?? "Adresse konnte nicht gespeichert werden"); return; }
    setPropertyForm({ ...EMPTY_PROP, label: "Weiterer Standort" });
    setAddingProperty(false);
    load();
  }

  function startEditProp(p: Property) {
    setEditPropId(p.id);
    setPropError("");
    setEditProp({
      label: p.label,
      street: p.street,
      zipCode: p.zipCode,
      city: p.city,
      notes: p.notes ?? "",
      travelZoneId: p.travelZoneId ?? "",
    });
  }

  async function patchProperty(propId: string, data: Record<string, unknown>) {
    setPropError("");
    const res = await fetch(`/api/properties/${propId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const d = await res.json();
    if (!d.success) { setPropError(d.error ?? "Adresse konnte nicht gespeichert werden"); return false; }
    return true;
  }

  async function saveEditProp(propId: string) {
    const ok = await patchProperty(propId, {
      ...editProp,
      travelZoneId: editProp.travelZoneId || null,
    });
    if (ok) { setEditPropId(null); load(); }
  }

  async function removeProperty(p: Property) {
    if (!confirm(`Adresse "${p.label}" wirklich löschen?`)) return;
    const res = await fetch(`/api/properties/${p.id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success && d.data?.message) alert(d.data.message);
    load();
  }

  async function remove() {
    if (!confirm("Kunde wirklich löschen?")) return;
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) router.push("/dashboard/kunden");
    else alert(data.error);
  }

  function zoneLabel(p: Property) {
    if (!p.travelZone) return "Keine Zone zugeordnet";
    return p.travelZone.useFormula ? `${p.travelZone.name} (Formel)` : p.travelZone.name;
  }

  if (!customer) return <p className="text-slate-500">Laden...</p>;

  const mailtoHref = `mailto:${customer.email}?subject=${encodeURIComponent(`Nachricht von Ihrem Handwerksbetrieb`)}`;

  return (
    <div>
      <Link href="/dashboard/kunden" className="flex items-center gap-1 text-sm text-[#0d5c63] mb-4 hover:underline">
        <ChevronLeft className="h-4 w-4" /> Zurück zu Kunden
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{customer.firstName} {customer.lastName}</h1>
        <Button variant="outline" size="sm" onClick={remove} className="text-red-600">
          <Trash2 className="h-4 w-4 mr-1" /> Löschen
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Stammdaten">
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Vorname" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              <Input label="Nachname" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <Input label="E-Mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Firma" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <Textarea label="Notizen" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            <Button type="submit" size="sm">Speichern</Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title="Kontakt">
            <div className="space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {customer.email}</p>
              {customer.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {customer.phone}</p>}
            </div>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <a href={mailtoHref}><Mail className="h-4 w-4 mr-1" /> E-Mail schreiben</a>
            </Button>
            <p className="text-xs text-slate-400 mt-2">
              Es wird keine E-Mail automatisch versendet. Nachrichten an den Kunden erfolgen bewusst über diese Aktion.
            </p>
          </Card>

          <Card title="Adressen / Standorte">
            {propError && <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{propError}</p>}

            {customer.properties.map((p) => (
              <div key={p.id} className="py-3 border-b border-slate-50 last:border-0">
                {editPropId === p.id ? (
                  <div className="space-y-2">
                    <Input label="Bezeichnung" value={editProp.label} onChange={(e) => setEditProp({ ...editProp, label: e.target.value })} />
                    <Input label="Straße" value={editProp.street} onChange={(e) => setEditProp({ ...editProp, street: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="PLZ" value={editProp.zipCode} onChange={(e) => setEditProp({ ...editProp, zipCode: e.target.value })} />
                      <Input label="Ort" value={editProp.city} onChange={(e) => setEditProp({ ...editProp, city: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Anfahrtszone</label>
                      <select
                        className="w-full h-9 rounded-lg border border-slate-300 px-3 text-sm mt-1"
                        value={editProp.travelZoneId}
                        onChange={(e) => setEditProp({ ...editProp, travelZoneId: e.target.value })}
                      >
                        <option value="">Keine Zone</option>
                        {activeZones.map((z) => (
                          <option key={z.id} value={z.id}>{z.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button type="button" variant="action" size="sm" onClick={() => saveEditProp(p.id)}>
                        <Check className="h-4 w-4 mr-1" /> Speichern
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditPropId(null)}>
                        <X className="h-4 w-4 mr-1" /> Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className={`flex-1 ${p.isActive ? "" : "opacity-50"}`}>
                      <p className="font-medium flex items-center gap-2 flex-wrap">
                        {p.label}
                        {p.isPrimary && (
                          <span className="text-xs rounded bg-amber-100 text-amber-700 px-1.5 py-0.5 flex items-center gap-1">
                            <Star className="h-3 w-3" /> Hauptadresse
                          </span>
                        )}
                        {!p.isActive && <span className="text-xs rounded bg-slate-200 px-1.5 py-0.5 text-slate-600">inaktiv</span>}
                      </p>
                      <p className="text-slate-500">{p.street}, {p.zipCode} {p.city}</p>
                      <p className={`text-xs mt-0.5 ${p.travelZone ? "text-slate-400" : "text-amber-600"}`}>
                        {zoneLabel(p)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => startEditProp(p)} title="Bearbeiten">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-red-600" onClick={() => removeProperty(p)} title="Löschen">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        {!p.isPrimary && (
                          <Button variant="ghost" size="xs" onClick={async () => { await patchProperty(p.id, { isPrimary: true }); load(); }}>
                            Als Haupt
                          </Button>
                        )}
                        <Button variant="ghost" size="xs" onClick={async () => { await patchProperty(p.id, { isActive: !p.isActive }); load(); }}>
                          {p.isActive ? "Deaktiv." : "Aktiv."}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!customer.properties.length && <p className="text-sm text-slate-500 mb-3">Noch keine Adressen.</p>}

            {addingProperty ? (
              <form onSubmit={addProperty} className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <p className="text-sm font-medium">Adresse hinzufügen</p>
                <Input label="Bezeichnung" value={propertyForm.label} onChange={(e) => setPropertyForm({ ...propertyForm, label: e.target.value })} />
                <Input label="Straße *" value={propertyForm.street} onChange={(e) => setPropertyForm({ ...propertyForm, street: e.target.value })} required />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="PLZ *" value={propertyForm.zipCode} onChange={(e) => setPropertyForm({ ...propertyForm, zipCode: e.target.value })} required />
                  <Input label="Ort *" value={propertyForm.city} onChange={(e) => setPropertyForm({ ...propertyForm, city: e.target.value })} required />
                </div>
                <div>
                  <label className="text-sm font-medium">Anfahrtszone</label>
                  <select
                    className="w-full h-9 rounded-lg border border-slate-300 px-3 text-sm mt-1"
                    value={propertyForm.travelZoneId}
                    onChange={(e) => setPropertyForm({ ...propertyForm, travelZoneId: e.target.value })}
                  >
                    <option value="">Keine Zone</option>
                    {activeZones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="action" size="sm">Adresse speichern</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setAddingProperty(false); setPropError(""); }}>Abbrechen</Button>
                </div>
              </form>
            ) : (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setAddingProperty(true)}>
                <Plus className="h-4 w-4 mr-1" /> Adresse hinzufügen
              </Button>
            )}
          </Card>

          <Card title="Aufträge">
            {customer.orders.map((o) => (
              <Link key={o.id} href={`/dashboard/auftraege/${o.id}`} className="block py-2 text-sm text-[#0d5c63] hover:underline">
                {o.orderNumber}
              </Link>
            ))}
            {!customer.orders.length && <p className="text-sm text-slate-500">Keine Aufträge.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
