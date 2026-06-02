"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calcMachinePaybackAnalysis } from "@/lib/calculation/formulas";
import { formatEuro } from "@/lib/utils";
import { CanAccess } from "@/components/auth/can-access";
import { Plus, Trash2, ChevronLeft, Calculator } from "lucide-react";

interface Machine {
  id: string;
  name: string;
  machineType: string | null;
  costMethod: "AMORTIZATION" | "FLAT_RATE";
  flatRatePerHourNet: number | null;
  purchasePriceNet: number;
  residualValueNet: number;
  expectedLifetimeHours: number;
  expectedRepairCostsNet: number;
  expectedMaintenanceCostsNet: number;
  expectedConsumablePartsNet: number;
  insuranceCostsNet: number;
  energyCostsTotalNet: number;
  breakageRiskPercent: number;
  calculatedHourlyRateNet: number;
}

const EMPTY = {
  name: "",
  machineType: "",
  costMethod: "AMORTIZATION" as "AMORTIZATION" | "FLAT_RATE",
  flatRatePerHourNet: "25",
  purchasePriceNet: "",
  residualValueNet: "0",
  expectedLifetimeYears: "3",
  expectedHoursPerYear: "400",
  expectedRepairCostsNet: "0",
  expectedMaintenanceCostsNet: "0",
  expectedConsumablePartsNet: "0",
  insuranceCostsNet: "0",
  energyCostsTotalNet: "0",
  breakageRiskPercent: "15",
};

export default function MaschinenPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function load() {
    fetch("/api/machines").then((r) => r.json()).then((d) => { if (d.success) setMachines(d.data); });
  }

  useEffect(() => { load(); }, []);

  const preview = useMemo(() => {
    const years = parseFloat(form.expectedLifetimeYears) || 3;
    const hoursPerYear = parseFloat(form.expectedHoursPerYear) || 400;
    const lifetimeHours = years * hoursPerYear;

    if (form.costMethod === "FLAT_RATE") {
      const rate = parseFloat(form.flatRatePerHourNet) || 0;
      if (rate <= 0) return null;
      return calcMachinePaybackAnalysis({
        costMethod: "FLAT_RATE",
        flatRatePerHourNet: rate,
        purchasePriceNet: 0,
        residualValueNet: 0,
        expectedRepairCostsNet: 0,
        expectedMaintenanceCostsNet: 0,
        expectedConsumablePartsNet: 0,
        insuranceCostsNet: 0,
        energyCostsTotalNet: 0,
        expectedLifetimeHours: lifetimeHours,
        breakageRiskPercent: 0,
        expectedHoursPerYear: hoursPerYear,
      });
    }

    const purchase = parseFloat(form.purchasePriceNet) || 0;
    if (purchase <= 0 || lifetimeHours <= 0) return null;
    return calcMachinePaybackAnalysis({
      costMethod: "AMORTIZATION",
      purchasePriceNet: purchase,
      residualValueNet: parseFloat(form.residualValueNet) || 0,
      expectedRepairCostsNet: parseFloat(form.expectedRepairCostsNet) || 0,
      expectedMaintenanceCostsNet: parseFloat(form.expectedMaintenanceCostsNet) || 0,
      expectedConsumablePartsNet: parseFloat(form.expectedConsumablePartsNet) || 0,
      insuranceCostsNet: parseFloat(form.insuranceCostsNet) || 0,
      energyCostsTotalNet: parseFloat(form.energyCostsTotalNet) || 0,
      expectedLifetimeHours: lifetimeHours,
      breakageRiskPercent: parseFloat(form.breakageRiskPercent) || 15,
      expectedHoursPerYear: hoursPerYear,
    });
  }, [form]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const years = parseFloat(form.expectedLifetimeYears) || 3;
    const hoursPerYear = parseFloat(form.expectedHoursPerYear) || 400;
    const res = await fetch("/api/machines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        machineType: form.machineType || undefined,
        costMethod: form.costMethod,
        flatRatePerHourNet: form.costMethod === "FLAT_RATE" ? parseFloat(form.flatRatePerHourNet) : undefined,
        purchasePriceNet: form.costMethod === "AMORTIZATION" ? parseFloat(form.purchasePriceNet) : 0,
        residualValueNet: parseFloat(form.residualValueNet) || 0,
        expectedLifetimeHours: years * hoursPerYear,
        expectedRepairCostsNet: parseFloat(form.expectedRepairCostsNet) || 0,
        expectedMaintenanceCostsNet: parseFloat(form.expectedMaintenanceCostsNet) || 0,
        expectedConsumablePartsNet: parseFloat(form.expectedConsumablePartsNet) || 0,
        insuranceCostsNet: parseFloat(form.insuranceCostsNet) || 0,
        energyCostsTotalNet: parseFloat(form.energyCostsTotalNet) || 0,
        breakageRiskPercent: parseFloat(form.breakageRiskPercent) || 15,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setShowForm(false);
      setForm(EMPTY);
      load();
    } else {
      setFormError(data.error ?? "Maschine konnte nicht angelegt werden.");
    }
  }

  async function deactivate(id: string) {
    if (!confirm("Maschine deaktivieren?")) return;
    await fetch(`/api/machines/${id}`, { method: "DELETE" });
    load();
  }

  function analysisForMachine(m: Machine) {
    const hoursPerYear = m.expectedLifetimeHours / 3;
    return calcMachinePaybackAnalysis({
      costMethod: m.costMethod,
      flatRatePerHourNet: m.flatRatePerHourNet,
      purchasePriceNet: m.purchasePriceNet,
      residualValueNet: m.residualValueNet,
      expectedRepairCostsNet: m.expectedRepairCostsNet,
      expectedMaintenanceCostsNet: m.expectedMaintenanceCostsNet,
      expectedConsumablePartsNet: m.expectedConsumablePartsNet,
      insuranceCostsNet: m.insuranceCostsNet,
      energyCostsTotalNet: m.energyCostsTotalNet,
      expectedLifetimeHours: m.expectedLifetimeHours,
      breakageRiskPercent: m.breakageRiskPercent,
      expectedHoursPerYear: hoursPerYear > 0 ? hoursPerYear : 400,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maschinen & Geräte</h1>
          <p className="text-sm text-slate-500 mt-1">Stundensatz per Amortisation oder einfache Pauschale</p>
        </div>
        <CanAccess permission="calculations.settings">
          <Button size="lg" variant="action" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-5 w-5" /> Maschine hinzufügen
          </Button>
        </CanAccess>
      </div>

      <Card className="mb-6 bg-slate-50 border-slate-200">
        <p className="text-sm font-semibold text-slate-800 mb-2">Wie werden Maschinenkosten berechnet?</p>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-600">
          <div>
            <p className="font-medium text-slate-700 mb-1">Amortisation (detailliert)</p>
            <p>Gesamtkosten = Anschaffung − Restwert + Reparatur + Wartung + Verschleiß + Versicherung + Energie</p>
            <p className="mt-1">Stundensatz = Gesamtkosten ÷ Nutzungsstunden × (1 + Ausfallrisiko %)</p>
            <p className="mt-1 text-xs text-slate-500">Restwert = erwarteter Verkaufswert am Lebensende (nicht der Wert heute). 0 € = volle Anschaffung abschreiben.</p>
            <p className="mt-2 font-medium text-slate-700">Ersatzrücklage am Lebensende</p>
            <p>= (Stundensatz × Nutzungsstunden) − Gesamtkosten — der Überschuss für die nächste Maschine, wenn der Stundensatz den Ausfallrisiko-Zuschlag enthält.</p>
            <p className="mt-1 text-xs text-slate-500">In der Kalkulation: Stundensatz × Einsatzstunden = Maschinenkosten</p>
          </div>
          <div>
            <p className="font-medium text-slate-700 mb-1">Pauschale (einfach)</p>
            <p>Sie geben direkt einen €/h-Satz ein – ideal wenn Anschaffungsdaten unbekannt sind.</p>
            <p className="mt-1">Maschinenkosten = Pauschale × Einsatzstunden (in der Kalkulation bearbeitbar)</p>
          </div>
        </div>
      </Card>

      <CanAccess permission="calculations.settings">
      {showForm && (
        <Card title="Neue Maschine" className="mb-6">
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Berechnungsmethode</label>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden mt-1">
                <button
                  type="button"
                  className={`flex-1 px-4 py-2 text-sm font-medium ${form.costMethod === "AMORTIZATION" ? "bg-[#0d5c63] text-white" : "bg-white text-slate-600"}`}
                  onClick={() => setForm({ ...form, costMethod: "AMORTIZATION" })}
                >
                  Amortisation
                </button>
                <button
                  type="button"
                  className={`flex-1 px-4 py-2 text-sm font-medium ${form.costMethod === "FLAT_RATE" ? "bg-[#0d5c63] text-white" : "bg-white text-slate-600"}`}
                  onClick={() => setForm({ ...form, costMethod: "FLAT_RATE" })}
                >
                  Pauschale €/h
                </button>
              </div>
            </div>

            <Input label="Bezeichnung *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Typ" value={form.machineType} onChange={(e) => setForm({ ...form, machineType: e.target.value })} placeholder="z. B. Kompressor" />

            {form.costMethod === "FLAT_RATE" ? (
              <>
                <Input label="Pauschale netto (€/h) *" type="number" step="0.01" value={form.flatRatePerHourNet} onChange={(e) => setForm({ ...form, flatRatePerHourNet: e.target.value })} required />
                <Input label="Geplante Stunden/Jahr (für Übersicht)" type="number" value={form.expectedHoursPerYear} onChange={(e) => setForm({ ...form, expectedHoursPerYear: e.target.value })} />
              </>
            ) : (
              <>
                <Input label="Anschaffung netto (€) *" type="number" value={form.purchasePriceNet} onChange={(e) => setForm({ ...form, purchasePriceNet: e.target.value })} required />
                <Input label="Restwert am Lebensende (€)" type="number" value={form.residualValueNet} onChange={(e) => setForm({ ...form, residualValueNet: e.target.value })} />
                <Input label="Erwartete Nutzungsdauer (Jahre)" type="number" value={form.expectedLifetimeYears} onChange={(e) => setForm({ ...form, expectedLifetimeYears: e.target.value })} />
                <Input label="Betriebsstunden pro Jahr" type="number" value={form.expectedHoursPerYear} onChange={(e) => setForm({ ...form, expectedHoursPerYear: e.target.value })} />
                <Input label="Reparaturkosten gesamt (€)" type="number" value={form.expectedRepairCostsNet} onChange={(e) => setForm({ ...form, expectedRepairCostsNet: e.target.value })} />
                <Input label="Wartungskosten gesamt (€)" type="number" value={form.expectedMaintenanceCostsNet} onChange={(e) => setForm({ ...form, expectedMaintenanceCostsNet: e.target.value })} />
                <Input label="Verschleißteile (€)" type="number" value={form.expectedConsumablePartsNet} onChange={(e) => setForm({ ...form, expectedConsumablePartsNet: e.target.value })} />
                <Input label="Versicherung (€)" type="number" value={form.insuranceCostsNet} onChange={(e) => setForm({ ...form, insuranceCostsNet: e.target.value })} />
                <Input label="Energiekosten gesamt (€)" type="number" value={form.energyCostsTotalNet} onChange={(e) => setForm({ ...form, energyCostsTotalNet: e.target.value })} />
                <Input label="Ausfallrisiko (%)" type="number" value={form.breakageRiskPercent} onChange={(e) => setForm({ ...form, breakageRiskPercent: e.target.value })} />
              </>
            )}

            {preview && (
              <div className="sm:col-span-2 rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="font-medium flex items-center gap-2 mb-3"><Calculator className="h-4 w-4" /> Vorschau</p>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <p>Stundensatz: <strong>{formatEuro(preview.hourlyRateNet)}/h</strong></p>
                  {!preview.isFlatRate && (
                    <>
                      <p>Amortisation nach: <strong>{preview.paybackYears} Jahren</strong> ({preview.paybackHours} h)</p>
                      <p>Einnahmen über Lebensdauer: <strong>{formatEuro(preview.totalRecoveryOverLifetime)}</strong></p>
                      <p>Ersatzrücklage am Ende: <strong>{formatEuro(preview.replacementReserveAtEnd)}</strong></p>
                    </>
                  )}
                </div>
                {!preview.isFlatRate && (
                  <p className={`mt-2 text-sm font-medium ${preview.paysBackBeforeEndOfLife && preview.canFundReplacement ? "text-green-700" : "text-amber-700"}`}>
                    {preview.paysBackBeforeEndOfLife && preview.canFundReplacement
                      ? "✓ Maschine finanziert sich vor Lebensende"
                      : "⚠ Parameter prüfen – Amortisation evtl. zu lang"}
                  </p>
                )}
              </div>
            )}

            {formError && (
              <p className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
            )}

            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" variant="action" disabled={saving}>{saving ? "Speichern..." : "Maschine anlegen"}</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
            </div>
          </form>
        </Card>
      )}
      </CanAccess>

      <div className="grid gap-4">
        {machines.map((m) => {
          const a = analysisForMachine(m);
          return (
            <Card key={m.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{m.name}</h3>
                  <p className="text-xs text-slate-500">
                    {m.costMethod === "FLAT_RATE" ? "Pauschale" : "Amortisation"}
                    {m.machineType ? ` · ${m.machineType}` : ""}
                  </p>
                </div>
                <CanAccess permission="calculations.settings">
                  <button onClick={() => deactivate(m.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CanAccess>
              </div>
              <div className="mt-4 grid sm:grid-cols-4 gap-3 text-sm">
                {m.costMethod === "AMORTIZATION" && (
                  <div><p className="text-slate-400 text-xs">Anschaffung</p><p className="font-medium">{formatEuro(m.purchasePriceNet)}</p></div>
                )}
                <div><p className="text-slate-400 text-xs">Stundensatz</p><p className="font-medium text-[#0d5c63]">{formatEuro(m.calculatedHourlyRateNet)}/h</p></div>
                {!a.isFlatRate && (
                  <div><p className="text-slate-400 text-xs">Amortisation</p><p className="font-medium">{a.paybackYears} Jahre</p></div>
                )}
                <div><p className="text-slate-400 text-xs">Jährlich (bei Vollauslastung)</p><p className="font-medium">{formatEuro(a.annualRecovery)}</p></div>
              </div>
            </Card>
          );
        })}
        {!machines.length && (
          <Card><p className="text-center text-slate-500 py-8">Noch keine Maschinen angelegt.</p></Card>
        )}
      </div>

      <Link href="/dashboard/kalkulation/einstellungen" className="inline-flex items-center gap-1 text-sm text-[#0d5c63] mt-6 hover:underline">
        <ChevronLeft className="h-4 w-4" /> Kalkulationseinstellungen
      </Link>
    </div>
  );
}
