"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { saveJson } from "@/lib/save-toast";
import { Clock } from "lucide-react";

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number | null;
  isActive: boolean;
  qualifications: { name: string }[];
}

export default function LeistungenPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    durationMinutes: 60 as number | null,
    bufferMinutes: 15 as number | null,
    priceEuro: null as number | null,
  });

  function load() {
    fetch("/api/services").then((r) => r.json()).then((d) => {
      if (d.success) setServices(d.data.filter((s: Service) => s.isActive));
    });
  }

  useEffect(() => { load(); }, []);

  async function createService(e: React.FormEvent) {
    e.preventDefault();
    const res = await saveJson("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        durationMinutes: form.durationMinutes ?? 0,
        bufferMinutes: form.bufferMinutes ?? 0,
        priceCents: form.priceEuro != null ? Math.round(form.priceEuro * 100) : undefined,
      }),
    });
    if (res.success) {
      setShowForm(false);
      setForm({ name: "", description: "", durationMinutes: 60, bufferMinutes: 15, priceEuro: null });
      load();
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leistungskatalog</h1>
          <p className="text-sm text-slate-500 mt-1">Leistungen mit Dauer, Preis und Stückliste für Aufträge</p>
        </div>
        <CanAccess permission="services.write">
          <AddButton onClick={() => setShowForm(!showForm)}>
            Leistung hinzufügen
          </AddButton>
        </CanAccess>
      </div>

      <CanAccess permission="services.write">
      {showForm && (
        <Card title="Neue Leistung" className="mb-6">
          <form onSubmit={createService} className="grid gap-3 sm:grid-cols-2">
            <Input label="Bezeichnung *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="sm:col-span-2" />
            <Textarea label="Beschreibung" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="sm:col-span-2" />
            <NumberInput label="Dauer (Min.)" required allowDecimal={false} min={0} value={form.durationMinutes} onValueChange={(v) => setForm({ ...form, durationMinutes: v })} />
            <NumberInput label="Puffer (Min.)" allowDecimal={false} min={0} value={form.bufferMinutes} onValueChange={(v) => setForm({ ...form, bufferMinutes: v })} />
            <NumberInput label="Listenpreis" suffix="€" value={form.priceEuro} onValueChange={(v) => setForm({ ...form, priceEuro: v })} />
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" variant="action">Speichern</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
            </div>
          </form>
        </Card>
      )}
      </CanAccess>

      <div className="grid gap-4">
        {services.map((s) => (
          <Link key={s.id} href={`/dashboard/leistungen/${s.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{s.name}</h3>
                  {s.description && <p className="text-sm text-slate-500 mt-1">{s.description}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Aktiv</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.durationMinutes} Min.</span>
                {s.priceCents != null && <span>{formatCurrency(s.priceCents)}</span>}
                {s.bufferMinutes > 0 && <span>Puffer: {s.bufferMinutes} Min.</span>}
              </div>
              <p className="text-xs text-[#0d5c63] mt-2">Stückliste bearbeiten →</p>
            </Card>
          </Link>
        ))}
        {!services.length && (
          <Card><p className="text-center text-slate-500 py-8">Noch keine Leistungen. Legen Sie die erste an.</p></Card>
        )}
      </div>
    </div>
  );
}
