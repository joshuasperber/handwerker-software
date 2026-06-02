"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, MapPin, Mail, Phone, Trash2 } from "lucide-react";

interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  notes: string | null;
  properties: { id: string; label: string; street: string; zipCode: string; city: string }[];
  orders: { id: string; orderNumber: string; status: string; createdAt: string }[];
}

export default function KundeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "", notes: "" });
  const [propertyForm, setPropertyForm] = useState({ label: "Einsatzort", street: "", zipCode: "", city: "" });

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

  useEffect(() => { load(); }, [id]);

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
    await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: id, ...propertyForm }),
    });
    setPropertyForm({ label: "Einsatzort", street: "", zipCode: "", city: "" });
    load();
  }

  async function remove() {
    if (!confirm("Kunde wirklich löschen?")) return;
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) router.push("/dashboard/kunden");
    else alert(data.error);
  }

  if (!customer) return <p className="text-slate-500">Laden...</p>;

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
          </Card>

          <Card title="Objekte / Einsatzorte">
            {customer.properties.map((p) => (
              <div key={p.id} className="py-2 flex items-start gap-2 text-sm border-b border-slate-50 last:border-0">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="font-medium">{p.label}</p>
                  <p className="text-slate-500">{p.street}, {p.zipCode} {p.city}</p>
                </div>
              </div>
            ))}
            {!customer.properties.length && <p className="text-sm text-slate-500 mb-3">Noch keine Objekte.</p>}
            <form onSubmit={addProperty} className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <p className="text-sm font-medium">Objekt hinzufügen</p>
              <Input label="Bezeichnung" value={propertyForm.label} onChange={(e) => setPropertyForm({ ...propertyForm, label: e.target.value })} />
              <Input label="Straße *" value={propertyForm.street} onChange={(e) => setPropertyForm({ ...propertyForm, street: e.target.value })} required />
              <div className="grid grid-cols-2 gap-2">
                <Input label="PLZ *" value={propertyForm.zipCode} onChange={(e) => setPropertyForm({ ...propertyForm, zipCode: e.target.value })} required />
                <Input label="Ort *" value={propertyForm.city} onChange={(e) => setPropertyForm({ ...propertyForm, city: e.target.value })} required />
              </div>
              <Button type="submit" size="sm">Objekt speichern</Button>
            </form>
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
