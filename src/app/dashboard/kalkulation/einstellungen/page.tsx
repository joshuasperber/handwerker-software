"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Save } from "lucide-react";
import { formatEuro } from "@/lib/utils";
import { CanAccess } from "@/components/auth/can-access";

interface CompanyForm {
  companyName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  defaultHourlyRate: number;
  defaultWorkshopHourlyRate: number;
  defaultMaterialMarkupPercent: number;
  defaultRiskPercent: number;
  defaultProfitPercent: number;
  defaultKilometerRate: number;
  defaultTravelHourlyRate: number;
}

interface FixedCostRow {
  id: string;
  name: string;
  category: string;
  amountNet: number;
  isActive: boolean;
}

export default function KalkulationEinstellungenPage() {
  const [company, setCompany] = useState<CompanyForm>({
    companyName: "",
    street: "",
    houseNumber: "",
    postalCode: "",
    city: "",
    defaultHourlyRate: 68,
    defaultWorkshopHourlyRate: 55,
    defaultMaterialMarkupPercent: 25,
    defaultRiskPercent: 7,
    defaultProfitPercent: 12,
    defaultKilometerRate: 0.45,
    defaultTravelHourlyRate: 45,
  });
  const [productiveHours, setProductiveHours] = useState(160);
  const [overheadMode, setOverheadMode] = useState("HYBRID");
  const [fixedCosts, setFixedCosts] = useState<FixedCostRow[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [newCostName, setNewCostName] = useState("");
  const [newCostAmount, setNewCostAmount] = useState("");

  useEffect(() => {
    fetch("/api/company-settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        if (d.data.company) {
          setCompany({
            companyName: d.data.company.companyName ?? "",
            street: d.data.company.street ?? "",
            houseNumber: d.data.company.houseNumber ?? "",
            postalCode: d.data.company.postalCode ?? "",
            city: d.data.company.city ?? "",
            defaultHourlyRate: d.data.company.defaultHourlyRate,
            defaultWorkshopHourlyRate: d.data.company.defaultWorkshopHourlyRate,
            defaultMaterialMarkupPercent: d.data.company.defaultMaterialMarkupPercent,
            defaultRiskPercent: d.data.company.defaultRiskPercent,
            defaultProfitPercent: d.data.company.defaultProfitPercent,
            defaultKilometerRate: d.data.company.defaultKilometerRate,
            defaultTravelHourlyRate: d.data.company.defaultTravelHourlyRate,
          });
        }
        if (d.data.overhead) {
          setProductiveHours(d.data.overhead.productiveHoursPerMonth);
          setOverheadMode(d.data.overhead.overheadCalculationMode);
        }
      });

    fetch("/api/fixed-costs")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setFixedCosts(d.data.costs);
          setMonthlyTotal(d.data.monthlyTotal);
        }
      });
  }, []);

  async function saveSettings() {
    setSaving(true);
    await fetch("/api/company-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company,
        overhead: {
          productiveHoursPerMonth: productiveHours,
          overheadCalculationMode: overheadMode,
        },
      }),
    });
    setSaving(false);
  }

  async function addFixedCost() {
    if (!newCostName || !newCostAmount) return;
    const res = await fetch("/api/fixed-costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCostName,
        amountNet: parseFloat(newCostAmount),
        category: "SONSTIGE",
      }),
    });
    const d = await res.json();
    if (d.success) {
      setFixedCosts((prev) => [...prev, d.data]);
      setMonthlyTotal((t) => t + d.data.amountNet);
      setNewCostName("");
      setNewCostAmount("");
    }
  }

  const hourlyOverhead = productiveHours > 0 ? monthlyTotal / productiveHours : 0;

  return (
    <div>
      <Link href="/dashboard/kalkulation" className="text-sm text-[#0d5c63] flex items-center gap-1 mb-4">
        <ChevronLeft className="h-4 w-4" /> Zurück zur Kalkulation
      </Link>
      <Link href="/dashboard/maschinen" className="text-sm text-[#0d5c63] flex items-center gap-1 mb-4 ml-4">
        Maschinen & Amortisation →
      </Link>

      <h1 className="text-2xl font-bold mb-6">Unternehmensprofil & Gemeinkosten</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Unternehmensadresse">
          <p className="text-sm text-slate-500 mb-4">Startpunkt für Entfernungsberechnungen zu Kunden</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Firmenname" value={company.companyName} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} />
            <Input label="Straße" value={company.street} onChange={(e) => setCompany({ ...company, street: e.target.value })} />
            <Input label="Hausnr." value={company.houseNumber} onChange={(e) => setCompany({ ...company, houseNumber: e.target.value })} />
            <Input label="PLZ" value={company.postalCode} onChange={(e) => setCompany({ ...company, postalCode: e.target.value })} />
            <Input label="Ort" value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 mt-4">
            <Input label="Stundensatz vor Ort (€)" type="number" value={company.defaultHourlyRate} onChange={(e) => setCompany({ ...company, defaultHourlyRate: parseFloat(e.target.value) })} />
            <Input label="Werkstatt-Stundensatz (€)" type="number" value={company.defaultWorkshopHourlyRate} onChange={(e) => setCompany({ ...company, defaultWorkshopHourlyRate: parseFloat(e.target.value) })} />
            <Input label="Materialaufschlag %" type="number" value={company.defaultMaterialMarkupPercent} onChange={(e) => setCompany({ ...company, defaultMaterialMarkupPercent: parseFloat(e.target.value) })} />
            <Input label="Standard Wagnis %" type="number" value={company.defaultRiskPercent} onChange={(e) => setCompany({ ...company, defaultRiskPercent: parseFloat(e.target.value) })} />
            <Input label="Standard Gewinn %" type="number" value={company.defaultProfitPercent} onChange={(e) => setCompany({ ...company, defaultProfitPercent: parseFloat(e.target.value) })} />
          </div>
          <CanAccess permission="calculations.settings">
            <Button className="mt-4" variant="action" onClick={saveSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> Speichern
            </Button>
          </CanAccess>
        </Card>

        <Card title="Gemeinkosten">
          <p className="text-sm text-slate-600 mb-2">
            Monatliche Fixkosten: <strong>{formatEuro(monthlyTotal)}</strong>
          </p>
          <p className="text-sm text-slate-600 mb-4">
            Bei <strong>{productiveHours}</strong> produktiven Stunden:{" "}
            <strong>{formatEuro(hourlyOverhead)}</strong> / Stunde
          </p>
          <Input
            label="Produktive Stunden pro Monat"
            type="number"
            value={productiveHours}
            onChange={(e) => setProductiveHours(parseFloat(e.target.value))}
          />
          <label className="text-sm font-medium block mt-4 mb-1">Berechnungsmodus</label>
          <select
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
            value={overheadMode}
            onChange={(e) => setOverheadMode(e.target.value)}
          >
            <option value="HYBRID">Hybrid (Stunde + optional %)</option>
            <option value="HOURLY_ALLOCATION">Pro produktiver Stunde</option>
            <option value="PERCENTAGE">Prozent auf direkte Kosten</option>
          </select>
        </Card>
      </div>

      <Card title="Monatliche Fixkosten" className="mt-6">
        <div className="space-y-2 mb-4">
          {fixedCosts.map((c) => (
            <div key={c.id} className="flex justify-between text-sm py-2 border-b border-slate-50">
              <span>{c.name} <span className="text-slate-400">({c.category})</span></span>
              <span className="font-medium">{formatEuro(c.amountNet)}</span>
            </div>
          ))}
        </div>
        <CanAccess permission="calculations.settings">
        <div className="flex gap-2 flex-wrap">
          <Input label="Bezeichnung" value={newCostName} onChange={(e) => setNewCostName(e.target.value)} className="flex-1 min-w-[140px]" />
          <Input label="Betrag netto" type="number" value={newCostAmount} onChange={(e) => setNewCostAmount(e.target.value)} className="w-32" />
          <Button variant="outline" className="self-end" onClick={addFixedCost}>Hinzufügen</Button>
        </div>
        </CanAccess>
      </Card>
    </div>
  );
}
