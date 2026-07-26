"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { InfoButton } from "@/components/ui/info-button";
import { SummaryPanel } from "@/components/calculation/summary-panel";
import { PriceCompositionPanel } from "@/components/calculation/price-composition";
import { FixedPriceEditor } from "@/components/calculation/fixed-price-editor";
import {
  InvoiceConflictDialog,
  type ExistingInvoiceInfo,
} from "@/components/documents/invoice-conflict-dialog";
import { compareFixedPrice } from "@/lib/calculation/fixed-price";
import { convertCalculationToInvoice } from "@/lib/documents/convert-invoice-client";
import type { InvoiceActionMode } from "@/lib/documents/invoice-lifecycle";
import { RISK_PERCENT_BY_LEVEL } from "@/lib/calculation/formulas";
import { formatEuro } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Save, FileText, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import {
  TAX_TREATMENT_LABELS,
  REVERSE_CHARGE_WARNING,
  BUILDING_EXEMPTION_INFO,
  reverseChargeWarnings,
  type TaxTreatment,
} from "@/lib/tax/treatment";
import { calcMaterialItemSales, calcMaterialTotal } from "@/lib/calculation/formulas";
import { articlePriceForCalculation } from "@/lib/inventory/units";

const STEPS = [
  "Kunde & Ort",
  "Arbeit",
  "Material",
  "Maschinen",
  "Beschaffung",
  "Fahrt",
  "Zusatz",
  "Gemeinkosten",
  "Wagnis & Gewinn",
  "Steuer & Ergebnis",
  "Angebot",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CalcData = Record<string, any>;

type InventoryArticleOption = {
  id: string;
  name: string;
  unit: string;
  purchasePriceNet: number | null;
  salesPriceNet: number | null;
  packageSize?: number;
  supplierName?: string | null;
  description?: string | null;
};

export default function KalkulationWizardPage() {
  const { id } = useParams();
  const [step, setStep] = useState(0);
  const [calc, setCalc] = useState<CalcData | null>(null);
  const [customers, setCustomers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; calculatedHourlyRateNet: number }[]>([]);
  const [articles, setArticles] = useState<InventoryArticleOption[]>([]);
  const [defaultMarkup, setDefaultMarkup] = useState(25);
  const [saving, setSaving] = useState(false);
  const [overheadInfo, setOverheadInfo] = useState<CalcData | null>(null);
  const [invoiceConflictOpen, setInvoiceConflictOpen] = useState(false);
  const [invoiceConflict, setInvoiceConflict] = useState<ExistingInvoiceInfo | null>(null);
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/calculations/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setCalc(d.data); });
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/customers").then((r) => r.json()).then((d) => { if (d.success) setCustomers(d.data); });
    fetch("/api/machines").then((r) => r.json()).then((d) => { if (d.success) setMachines(d.data); });
    fetch("/api/articles").then((r) => r.json()).then((d) => { if (d.success) setArticles(d.data); });
    fetch("/api/company-settings")
      .then((r) => r.json())
      .then((d) => {
        const markup = d.success
          ? d.data?.company?.defaultMaterialMarkupPercent ?? d.data?.defaultMaterialMarkupPercent
          : null;
        if (markup != null) setDefaultMarkup(Number(markup));
      })
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    if (calc?.totalBillableHours != null) {
      fetch(`/api/overhead/summary?billableHours=${calc.totalBillableHours}&directCosts=${calc.directCosts ?? 0}`)
        .then((r) => r.json())
        .then((d) => { if (d.success) setOverheadInfo(d.data); });
    }
  }, [calc?.totalBillableHours, calc?.directCosts]);

  async function save(payload: CalcData) {
    setSaving(true);
    const res = await fetch(`/api/calculations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      setCalc(data.data.calculation ?? data.data);
    }
    setSaving(false);
  }

  async function loadExample() {
    const machinesRes = await fetch("/api/machines");
    const machinesData = await machinesRes.json();
    const machineId = machinesData.success && machinesData.data[0]?.id;

    await save({
      laborItems: [
        { description: "Arbeit vor Ort", laborType: "ONSITE_WORK", hours: 5, hourlyRateNet: 68, quantityWorkers: 1 },
      ],
      materialItems: [
        { name: "Material", quantity: 1, unit: "Stk", purchasePriceNet: 180, markupPercent: 25, wastePercent: 0 },
      ],
      machineUsages: machineId
        ? [{ machineId, description: "Maschineneinsatz", usageHours: 5, breakageRiskPercent: 15 }]
        : undefined,
      procurementCosts: [
        {
          description: "Beschaffung",
          purchasingTimeHours: 0.25,
          procurementHourlyRateNet: 55,
          pickupDistanceKm: 0,
          pickupKilometerRateNet: 0,
        },
      ],
      travel: {
        startAddress: "Musterstraße 1, 10115 Berlin",
        destinationAddress: "Hauptstraße 42, 10115 Berlin",
        distanceKm: 46,
        estimatedDriveTimeHours: 0.5,
        kilometerRateNet: 0.45,
        travelHourlyRateNet: 45,
      },
      risk: { riskLevel: "NORMAL", riskPercent: 7 },
      profit: { profitStrategy: "PERCENT", profitPercent: 12 },
    });
    load();
  }

  async function generateOffer() {
    const res = await fetch("/api/documents/generate-offer-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calculationId: id }),
    });
    const data = await res.json();
    if (data.success && data.data.html) {
      const w = window.open("", "_blank");
      w?.document.write(data.data.html);
      w?.document.close();
    }
  }

  async function previewBreakdown() {
    const res = await fetch("/api/documents/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calculationId: id, type: "breakdown" }),
    });
    const data = await res.json();
    if (data.success && data.data.html) {
      const w = window.open("", "_blank");
      w?.document.write(data.data.html);
      w?.document.close();
    }
  }

  async function saveInvoice(mode?: InvoiceActionMode, documentId?: string) {
    if (!id || typeof id !== "string") return;
    setInvoiceSaving(true);
    const result = await convertCalculationToInvoice(id, { mode, documentId });
    setInvoiceSaving(false);

    if (!result.ok) {
      if (result.conflict) {
        setInvoiceConflict(result.invoice);
        setInvoiceConflictOpen(true);
        return;
      }
      toast.error(result.message);
      return;
    }

    setInvoiceConflictOpen(false);
    const number = result.document?.documentNumber ?? "";
    const label =
      result.action === "updated"
        ? `Rechnung ${number} aktualisiert (gleiche ID)`
        : result.action === "correction"
          ? `Korrekturrechnung ${number} angelegt`
          : `Rechnung ${number} angelegt`;
    toast.success(label);
    load();
  }

  if (!calc) return <p className="text-slate-500 p-6">Laden...</p>;

  const fixedComparison = compareFixedPrice({
    useFixedPrice: calc.useFixedPrice,
    fixedPriceNet: calc.fixedPriceNet,
    fixedPriceLabel: calc.fixedPriceLabel,
    calculatedNet: calc.netSalesPrice ?? 0,
    profitAmount: calc.profitAmount,
    directCosts: calc.directCosts,
  });

  const breakdown = {
    netSalesPrice: calc.netSalesPrice,
    grossSalesPrice: calc.grossSalesPrice,
    profitAmount: calc.profitAmount,
    riskAmount: calc.riskAmount,
    marginPercent: calc.marginPercent,
    directCosts: calc.directCosts,
    profitabilityStatus: calc.profitabilityStatus,
    vatAmount: calc.vatAmount,
    taxTreatment: calc.vatSettings?.taxTreatment,
    isReverseCharge: calc.vatSettings?.taxTreatment === "REVERSE_CHARGE" || calc.vatSettings?.reverseCharge,
    useFixedPrice: fixedComparison.useFixedPrice,
    fixedPriceLabel: fixedComparison.label,
    fixedPriceNet: fixedComparison.customerNet,
    fixedDifference: fixedComparison.difference,
    fixedEstimatedProfit: fixedComparison.estimatedProfit,
    fixedMarginPercent: fixedComparison.marginPercent,
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard/kalkulation" className="text-sm text-[#0d5c63] flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Zurück
          </Link>
          {calc.orderId && (
            <Link
              href={`/dashboard/auftraege/${calc.orderId}`}
              className="text-sm text-[#0d5c63] hover:underline"
            >
              → Zum Auftrag
            </Link>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={loadExample}>Beispiel aus Spec laden</Button>
      </div>

      <h1 className="text-xl font-bold mb-4">{calc.title ?? "Kalkulation"}</h1>

      <div className="flex gap-1 overflow-x-auto mb-6 pb-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium ${
              i === step ? "bg-[#0d5c63] text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {step === 0 && (
            <Card title="Kunde & Einsatzort">
              <select
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm mb-4"
                value={calc.customerId ?? ""}
                onChange={(e) => setCalc({ ...calc, customerId: e.target.value || null })}
              >
                <option value="">Kunde wählen...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </Card>
          )}

          {step === 1 && (
            <Card title="Arbeitskosten">
              <LaborEditor
                items={calc.laborItems ?? []}
                onChange={(items) => setCalc({ ...calc, laborItems: items })}
              />
              <Button className="mt-4" variant="action" onClick={() => save({ laborItems: calc.laborItems })} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> Speichern & berechnen
              </Button>
            </Card>
          )}

          {step === 2 && (
            <Card title="Material">
              <MaterialEditor
                items={calc.materialItems ?? []}
                articles={articles}
                defaultMarkup={defaultMarkup}
                onChange={(items) => setCalc({ ...calc, materialItems: items })}
              />
              <p className="text-xs text-slate-400 mt-3">
                Preise werden aus dem Inventar übernommen und bleiben in dieser Kalkulation manuell änderbar.
                Der Lagerbestand wird dadurch nicht verändert — Entnahme erfolgt separat am Auftrag.
              </p>
              <Button className="mt-4" variant="action" onClick={() => save({ materialItems: calc.materialItems })} disabled={saving}>Speichern & berechnen</Button>
            </Card>
          )}

          {step === 5 && (
            <Card title="Fahrtkosten">
              <TravelEditor
                travel={calc.travelCost}
                calcId={id as string}
                onChange={(travel) => setCalc({ ...calc, travelCost: travel })}
              />
              <Button
                className="mt-4"
                variant="action"
                onClick={() =>
                  save({
                    travel: {
                      startAddress: calc.travelCost?.startAddress,
                      destinationAddress: calc.travelCost?.destinationAddress,
                      distanceKm: calc.travelCost?.distanceKm,
                      estimatedDriveTimeHours: calc.travelCost?.estimatedDriveTimeHours,
                      kilometerRateNet: calc.travelCost?.kilometerRateNet,
                      travelHourlyRateNet: calc.travelCost?.travelHourlyRateNet,
                    },
                  })
                }
                disabled={saving}
              >
                Speichern & berechnen
              </Button>
            </Card>
          )}

          {step === 8 && (
            <Card title="Wagnis & Gewinn">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Risikostufe</label>
                  <select
                    className="w-full h-10 rounded-lg border mt-1 px-3 text-sm"
                    value={calc.riskSettings?.riskLevel ?? "NORMAL"}
                    onChange={(e) => {
                      const level = e.target.value;
                      const pct = RISK_PERCENT_BY_LEVEL[level] ?? 7;
                      setCalc({
                        ...calc,
                        riskSettings: { ...calc.riskSettings, riskLevel: level, riskPercent: pct },
                      });
                    }}
                  >
                    {["LOW", "NORMAL", "HIGH", "VERY_HIGH", "CUSTOM"].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <NumberInput
                    label="Wagnis %"
                    suffix="%"
                    className="mt-2"
                    value={calc.riskSettings?.riskPercent ?? 7}
                    onValueChange={(v) =>
                      setCalc({
                        ...calc,
                        riskSettings: { ...calc.riskSettings, riskPercent: v ?? 7 },
                      })
                    }
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Wagnis deckt Nacharbeit, Reklamation, Wetter, Ausfall etc. – intern, nicht auf Rechnung.
                  </p>
                </div>
                <div>
                  <NumberInput
                    label="Gewinn %"
                    suffix="%"
                    value={calc.profitSettings?.profitPercent ?? 12}
                    onValueChange={(v) =>
                      setCalc({
                        ...calc,
                        profitSettings: { ...calc.profitSettings, profitPercent: v ?? 12, profitStrategy: "PERCENT" },
                      })
                    }
                  />
                </div>
              </div>
              <Button
                className="mt-4"
                variant="action"
                onClick={() => save({ risk: calc.riskSettings, profit: calc.profitSettings })}
                disabled={saving}
              >
                Speichern & berechnen
              </Button>
            </Card>
          )}

          {step === 9 && (
            <Card
              title="Steuer & Ergebnis"
              action={
                <InfoButton title="Steuerliche Behandlung">
                  <p>Die App trifft keine automatische steuerliche Entscheidung. Wählen Sie die Rechnungsart bewusst aus. Bei Unsicherheit bitte steuerlich prüfen lassen.</p>
                </InfoButton>
              }
            >
              <TaxTreatmentEditor
                calc={calc}
                onChange={(vatSettings) => setCalc({ ...calc, vatSettings })}
              />
              <div className="rounded-lg bg-slate-50 p-4 space-y-2 text-sm mt-4">
                <Row label="Direkte Kosten" value={calc.directCosts} />
                <Row label="Gemeinkosten" value={calc.overheadAmount} />
                <Row label="Wagnis" value={calc.riskAmount} />
                <Row label="Gewinn" value={calc.profitAmount} />
                <Row label="Netto-Verkaufspreis" value={calc.netSalesPrice} bold />
                {calc.vatSettings?.taxTreatment === "REVERSE_CHARGE" || calc.vatSettings?.reverseCharge ? (
                  <>
                    <Row label="Umsatzsteuer" value="— (Reverse-Charge)" />
                    <Row label="Rechnungsbetrag (netto)" value={calc.netSalesPrice} bold />
                  </>
                ) : (
                  <>
                    <Row label="Umsatzsteuer" value={calc.vatAmount} />
                    <Row label="Brutto" value={calc.grossSalesPrice} bold />
                  </>
                )}
                <Row label="Deckungsbeitrag" value={calc.contributionMargin} />
                <Row label="Deckungsbeitragsquote" value={`${calc.contributionMarginRate?.toFixed(1)} %`} />
                <Row label="Mindestpreis" value={calc.minimumPrice} />
              </div>
              <FixedPriceEditor
                useFixedPrice={Boolean(calc.useFixedPrice)}
                fixedPriceNet={calc.fixedPriceNet}
                fixedPriceLabel={calc.fixedPriceLabel}
                calculatedNet={calc.netSalesPrice ?? 0}
                profitAmount={calc.profitAmount ?? 0}
                directCosts={calc.directCosts ?? 0}
                onChange={(next) =>
                  setCalc({
                    ...calc,
                    useFixedPrice: next.useFixedPrice,
                    fixedPriceNet: next.fixedPriceNet,
                    fixedPriceLabel: next.fixedPriceLabel,
                  })
                }
              />
              <Button
                className="mt-4"
                variant="action"
                onClick={() =>
                  save({
                    vat: calc.vatSettings,
                    useFixedPrice: Boolean(calc.useFixedPrice),
                    fixedPriceNet: calc.fixedPriceNet ?? null,
                    fixedPriceLabel: calc.fixedPriceLabel ?? null,
                  })
                }
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-1" /> Steuer &amp; Festpreis speichern
              </Button>
            </Card>
          )}

          {step === 10 && (
            <Card title="Angebot erzeugen">
              <p className="text-sm text-slate-600 mb-4">
                {calc.useFixedPrice
                  ? `Aktuell: Festpreis „${calc.fixedPriceLabel?.trim() || "Festpreis"} – ${formatEuro(calc.fixedPriceNet ?? calc.netSalesPrice)}“ auf dem Dokument. Die interne Kalkulation (${formatEuro(calc.netSalesPrice)}) bleibt gespeichert.`
                  : "Auf dem Angebot erscheinen die Leistungspositionen (Arbeit, Material, Fahrt usw.). Interne Zuschläge wie Gemeinkosten, Wagnis und Gewinn bleiben verborgen."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="action" onClick={generateOffer}>
                  <FileText className="h-4 w-4 mr-1" /> Angebot als HTML erzeugen
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const res = await fetch(`/api/calculations/${id}/convert-to-offer`, { method: "POST" });
                    const d = await res.json();
                    if (d.success) alert(`Angebot ${d.data.documentNumber} angelegt`);
                  }}
                >
                  Als Angebot speichern
                </Button>
                <Button
                  variant="outline"
                  disabled={invoiceSaving}
                  onClick={() => saveInvoice()}
                >
                  Als Rechnung speichern
                </Button>
              </div>
              {Array.isArray(calc.documents) &&
                calc.documents.some(
                  (d: { documentType?: string; status?: string; cancelOfId?: string | null }) =>
                    d.documentType === "INVOICE" && d.status !== "STORNIERT" && !d.cancelOfId
                ) && (
                  <p className="text-xs text-amber-800 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    Zu dieser Kalkulation existiert bereits mindestens eine Rechnung. Beim erneuten
                    Speichern kannst du die bestehende bearbeiten oder bewusst eine neue/Korrektur
                    anlegen – es entsteht keine stille Doppelrechnung.
                  </p>
                )}
            </Card>
          )}

          {step === 3 && (
            <Card title="Maschinen">
              <MachineStepEditor
                machines={machines}
                items={calc.machineUsages ?? []}
                onChange={(items) => setCalc({ ...calc, machineUsages: items })}
              />
              <Button
                className="mt-4"
                variant="action"
                onClick={() => save({ machineUsages: calc.machineUsages })}
                disabled={saving}
              >
                Speichern & berechnen
              </Button>
            </Card>
          )}

          {step === 4 && (
            <Card title="Beschaffung">
              <ProcurementEditor
                items={calc.procurementCosts ?? []}
                onChange={(items) => setCalc({ ...calc, procurementCosts: items })}
              />
              <Button
                className="mt-4"
                variant="action"
                onClick={() => save({ procurementCosts: calc.procurementCosts })}
                disabled={saving}
              >
                Speichern & berechnen
              </Button>
            </Card>
          )}

          {(step === 6 || step === 7) && (
            <Card title={STEPS[step]}>
              {step === 7 && overheadInfo && (
                <p className="text-sm text-slate-700">{overheadInfo.explanation}</p>
              )}
              {step === 6 && (
                <>
                  <AdditionalCostEditor
                    items={calc.additionalItems ?? []}
                    onChange={(items) => setCalc({ ...calc, additionalItems: items })}
                  />
                  <Button
                    className="mt-4"
                    variant="action"
                    onClick={() => save({ additionalItems: calc.additionalItems })}
                    disabled={saving}
                  >
                    Speichern & berechnen
                  </Button>
                </>
              )}
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="h-4 w-4" /> Zurück
            </Button>
            <Button variant="outline" disabled={step >= STEPS.length - 1} onClick={() => setStep((s) => s + 1)}>
              Weiter <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <SummaryPanel breakdown={breakdown} />
        <PriceCompositionPanel
          calc={calc}
          onPreviewBreakdown={previewBreakdown}
          onPreviewInvoice={async () => {
            if (!id || typeof id !== "string") return;
            const result = await convertCalculationToInvoice(id, { preview: true });
            if (result.ok && result.html) {
              const w = window.open("", "_blank");
              w?.document.write(result.html);
              w?.document.close();
            }
          }}
        />
      </div>

      <InvoiceConflictDialog
        open={invoiceConflictOpen}
        onOpenChange={setInvoiceConflictOpen}
        invoice={invoiceConflict}
        loading={invoiceSaving}
        onChoose={(mode) =>
          saveInvoice(mode, mode === "update" ? invoiceConflict?.id : undefined)
        }
      />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number | string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-[#0d5c63]" : ""}`}>
      <span>{label}</span>
      <span>{typeof value === "number" ? formatEuro(value) : value}</span>
    </div>
  );
}

function PositionRemoveButton({ onRemove, label }: { onRemove: () => void; label?: string }) {
  return (
    <div className="col-span-2 flex justify-end">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-red-600 border-red-200 hover:bg-red-50"
        onClick={() => {
          if (confirm(label ? `Position „${label}" wirklich entfernen?` : "Position wirklich entfernen?")) {
            onRemove();
          }
        }}
      >
        <Trash2 className="h-4 w-4 mr-1" /> Entfernen
      </Button>
    </div>
  );
}

function TaxTreatmentEditor({
  calc,
  onChange,
}: {
  calc: CalcData;
  onChange: (vat: CalcData) => void;
}) {
  const vat = calc.vatSettings ?? {
    vatRatePercent: 19,
    taxTreatment: "STANDARD_VAT",
    reverseCharge: false,
    reverseChargeConfirmed: false,
    includeSection13bNote: true,
  };
  const treatment = (vat.taxTreatment ?? "STANDARD_VAT") as TaxTreatment;
  const customer = calc.customer as CalcData | null;
  const rcWarnings = treatment === "REVERSE_CHARGE" ? reverseChargeWarnings(customer) : [];

  function update(patch: CalcData) {
    onChange({ ...vat, ...patch });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Steuerliche Rechnungsart</label>
        <select
          className="w-full h-10 rounded-lg border mt-1 px-3 text-sm"
          value={treatment}
          onChange={(e) => {
            const next = e.target.value as TaxTreatment;
            update({
              taxTreatment: next,
              reverseCharge: next === "REVERSE_CHARGE",
              reverseChargeConfirmed: next === "REVERSE_CHARGE" ? vat.reverseChargeConfirmed : false,
            });
          }}
        >
          {(Object.keys(TAX_TREATMENT_LABELS) as TaxTreatment[]).map((key) => (
            <option key={key} value={key}>{TAX_TREATMENT_LABELS[key]}</option>
          ))}
        </select>
      </div>

      {treatment === "STANDARD_VAT" && (
        <NumberInput
          label="Umsatzsteuersatz"
          suffix="%"
          min={0}
          max={100}
          value={vat.vatRatePercent ?? 19}
          onValueChange={(v) => update({ vatRatePercent: v ?? 19 })}
        />
      )}

      {treatment === "REVERSE_CHARGE" && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{REVERSE_CHARGE_WARNING}</p>
          {rcWarnings.length > 0 && (
            <ul className="list-disc pl-5 space-y-1">
              {rcWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={!!vat.reverseChargeConfirmed}
              onChange={(e) => update({ reverseChargeConfirmed: e.target.checked, reverseCharge: true })}
            />
            <span>Ich bestätige, dass Reverse-Charge / § 13b UStG für diese Rechnung zutreffend ist.</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={vat.includeSection13bNote !== false}
              onChange={(e) => update({ includeSection13bNote: e.target.checked })}
            />
            <span>Hinweis auf § 13b UStG auf der Rechnung anzeigen</span>
          </label>
        </div>
      )}

      {treatment === "BUILDING_EXEMPTION" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p>{BUILDING_EXEMPTION_INFO}</p>
          <p className="mt-2">Die Freistellungsbescheinigung wird im Kundenstamm dokumentiert. Die Umsatzsteuer wird standardmäßig weiterhin berechnet, sofern Sie nicht Reverse-Charge wählen.</p>
          {customer?.id && (
            <Link href={`/dashboard/kunden/${customer.id}`} className="text-[#0d5c63] underline text-sm mt-2 inline-block">
              → Freistellungsbescheinigung im Kundenstamm pflegen
            </Link>
          )}
        </div>
      )}

      {treatment === "MANUAL_REVIEW" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Diese Rechnung erfordert eine manuelle steuerliche Prüfung vor dem Versand.
        </div>
      )}

      <Textarea
        label="Optionaler Hinweis auf der Rechnung"
        value={vat.vatNote ?? ""}
        onChange={(e) => update({ vatNote: e.target.value || null })}
        rows={2}
        placeholder="Zusätzlicher steuerlicher Hinweis (optional)"
      />
    </div>
  );
}

function AdditionalCostEditor({ items, onChange }: { items: CalcData[]; onChange: (items: CalcData[]) => void }) {
  const list = items;

  return (
    <div className="space-y-3">
      {list.length === 0 && (
        <p className="text-sm text-slate-500">Noch keine Zusatzkosten. Fügen Sie z. B. Fremdleistung oder Entsorgung hinzu.</p>
      )}
      {list.map((item, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 border-b pb-3">
          <Input
            label="Beschreibung"
            value={item.description ?? ""}
            onChange={(e) => {
              const n = [...list];
              n[i] = { ...n[i], description: e.target.value };
              onChange(n);
            }}
          />
          <NumberInput
            label="Betrag netto"
            suffix="€"
            min={0}
            value={item.amountNet ?? 0}
            onValueChange={(v) => {
              const n = [...list];
              n[i] = { ...n[i], amountNet: v ?? 0 };
              onChange(n);
            }}
          />
          <PositionRemoveButton
            label={item.description ?? "Zusatzkosten"}
            onRemove={() => onChange(list.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...list, { description: "Fremdleistung", amountNet: 0, category: "OTHER", markupPercent: 0 }])
        }
      >
        + Zusatzposition
      </Button>
    </div>
  );
}

function LaborEditor({
  items,
  onChange,
}: {
  items: CalcData[];
  onChange: (items: CalcData[]) => void;
}) {
  const list = items.length ? items : [{ description: "Arbeit vor Ort", hours: 0, hourlyRateNet: 68, quantityWorkers: 1, laborType: "ONSITE_WORK" }];

  return (
    <div className="space-y-3">
      {list.map((item, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 border-b pb-3">
          <Input label="Beschreibung" value={item.description} onChange={(e) => {
            const n = [...list]; n[i] = { ...n[i], description: e.target.value }; onChange(n);
          }} />
          <NumberInput label="Stunden" min={0} value={item.hours} onValueChange={(v) => {
            const n = [...list]; n[i] = { ...n[i], hours: v ?? 0 }; onChange(n);
          }} />
          <NumberInput label="Stundensatz netto" suffix="€" min={0} value={item.hourlyRateNet} onValueChange={(v) => {
            const n = [...list]; n[i] = { ...n[i], hourlyRateNet: v ?? 0 }; onChange(n);
          }} />
          <NumberInput label="Mitarbeiter" allowDecimal={false} min={1} value={item.quantityWorkers ?? 1} onValueChange={(v) => {
            const n = [...list]; n[i] = { ...n[i], quantityWorkers: v ?? 1 }; onChange(n);
          }} />
          {list.length > 1 && (
            <PositionRemoveButton
              label={item.description}
              onRemove={() => onChange(list.filter((_, idx) => idx !== i))}
            />
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...list, { description: "Werkstattzeit", hours: 0, hourlyRateNet: 55, quantityWorkers: 1, laborType: "WORKSHOP_WORK" }])}>
        + Position
      </Button>
    </div>
  );
}

function MaterialEditor({
  items,
  articles,
  defaultMarkup,
  onChange,
}: {
  items: CalcData[];
  articles: InventoryArticleOption[];
  defaultMarkup: number;
  onChange: (items: CalcData[]) => void;
}) {
  const list = items.length
    ? items
    : [{ name: "", quantity: 1, unit: "Stück", purchasePriceNet: 0, markupPercent: defaultMarkup, wastePercent: 0, articleId: null }];

  function updateItem(index: number, patch: CalcData) {
    const next = list.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  }

  function applyArticle(index: number, articleId: string) {
    if (!articleId) {
      updateItem(index, { articleId: null });
      return;
    }
    const article = articles.find((a) => a.id === articleId);
    if (!article) return;
    updateItem(index, {
      articleId: article.id,
      name: article.name,
      unit: article.unit || "Stück",
      purchasePriceNet: articlePriceForCalculation(article),
      description: article.description ?? undefined,
      supplierName: article.supplierName ?? undefined,
      markupPercent: list[index].markupPercent ?? defaultMarkup,
    });
  }

  function addFromInventory(articleId: string) {
    const article = articles.find((a) => a.id === articleId);
    if (!article) return;
    const blankOnly =
      list.length === 1 && !list[0].name && !list[0].articleId && Number(list[0].purchasePriceNet) === 0;
    const row = {
      articleId: article.id,
      name: article.name,
      unit: article.unit || "Stück",
      quantity: 1,
      purchasePriceNet: articlePriceForCalculation(article),
      markupPercent: defaultMarkup,
      wastePercent: 0,
      description: article.description ?? undefined,
      supplierName: article.supplierName ?? undefined,
    };
    onChange(blankOnly ? [row] : [...list, row]);
  }

  const materialSum = calcMaterialTotal(
    list.map((i) => ({
      quantity: Number(i.quantity) || 0,
      purchasePriceNet: Number(i.purchasePriceNet) || 0,
      markupPercent: Number(i.markupPercent) || 0,
      wastePercent: Number(i.wastePercent) || 0,
    }))
  );

  return (
    <div className="space-y-4">
      {articles.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
            <Package className="h-4 w-4 text-[#0d5c63]" />
            Aus Inventar hinzufügen
          </label>
          <select
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                addFromInventory(e.target.value);
                e.target.value = "";
              }
            }}
          >
            <option value="">Artikel wählen…</option>
            {articles.map((a) => {
              const price = articlePriceForCalculation(a);
              return (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.unit}
                  {price > 0 ? ` · ${price.toFixed(2)} €` : ""}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {list.map((item, i) => {
        const line = calcMaterialItemSales(
          Number(item.quantity) || 0,
          Number(item.purchasePriceNet) || 0,
          Number(item.markupPercent) || 0,
          Number(item.wastePercent) || 0
        );
        return (
          <div key={item.id ?? i} className="grid grid-cols-2 gap-2 border-b pb-3">
            {articles.length > 0 && (
              <div className="col-span-2">
                <label className="text-sm font-medium">Inventarartikel (optional)</label>
                <select
                  className="w-full h-10 rounded-lg border mt-1 px-3 text-sm"
                  value={item.articleId ?? ""}
                  onChange={(e) => applyArticle(i, e.target.value)}
                >
                  <option value="">Frei eingeben / ohne Inventar</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Input
              label="Name"
              value={item.name ?? ""}
              onChange={(e) => updateItem(i, { name: e.target.value })}
            />
            <NumberInput
              label="Menge"
              min={0}
              value={item.quantity}
              onValueChange={(v) => updateItem(i, { quantity: v ?? 0 })}
            />
            <Input
              label="Einheit"
              value={item.unit ?? "Stück"}
              onChange={(e) => updateItem(i, { unit: e.target.value })}
            />
            <NumberInput
              label="Preis netto"
              suffix="€"
              min={0}
              value={item.purchasePriceNet}
              onValueChange={(v) => updateItem(i, { purchasePriceNet: v ?? 0 })}
            />
            <NumberInput
              label="Aufschlag %"
              suffix="%"
              value={item.markupPercent}
              onValueChange={(v) => updateItem(i, { markupPercent: v ?? 0 })}
            />
            <div className="flex flex-col justify-end text-sm">
              <p className="text-xs text-slate-400">Position (Verkauf netto)</p>
              <p className="font-semibold text-[#0d5c63]">{formatEuro(line.sales)}</p>
              <p className="text-xs text-slate-400">Einkauf {formatEuro(line.purchase)}</p>
            </div>
            {list.length > 1 && (
              <PositionRemoveButton label={item.name} onRemove={() => onChange(list.filter((_, idx) => idx !== i))} />
            )}
          </div>
        );
      })}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange([
                ...list,
                {
                  name: "",
                  quantity: 1,
                  unit: "Stück",
                  purchasePriceNet: 0,
                  markupPercent: defaultMarkup,
                  wastePercent: 0,
                  articleId: null,
                },
              ])
            }
          >
            + Manuelle Position
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange([
                ...list,
                {
                  name: "Kleinmaterialpauschale",
                  quantity: 1,
                  unit: "Pausch.",
                  purchasePriceNet: 15,
                  markupPercent: defaultMarkup,
                  articleId: null,
                },
              ])
            }
          >
            + Kleinmaterialpauschale
          </Button>
        </div>
        <p className="text-sm font-semibold text-slate-800">
          Material gesamt: <span className="text-[#0d5c63]">{formatEuro(materialSum)}</span>
        </p>
      </div>
    </div>
  );
}

function MachineStepEditor({
  machines,
  items,
  onChange,
}: {
  machines: { id: string; name: string; calculatedHourlyRateNet: number }[];
  items: CalcData[];
  onChange: (items: CalcData[]) => void;
}) {
  const list =
    items.length > 0
      ? items
      : machines[0]
        ? [{ machineId: machines[0].id, description: "Maschineneinsatz", usageHours: 0, breakageRiskPercent: 15 }]
        : [];

  if (!machines.length) {
    return <p className="text-sm text-slate-500">Keine Maschinen hinterlegt. Legen Sie Maschinen unter Einstellungen an oder nutzen Sie den Demo-Seed.</p>;
  }

  return (
    <div className="space-y-3">
      {list.map((item, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 border-b pb-3">
          <div>
            <label className="text-sm font-medium">Maschine</label>
            <select
              className="w-full h-10 rounded-lg border mt-1 px-3 text-sm"
              value={item.machineId ?? machines[0].id}
              onChange={(e) => {
                const n = [...list];
                n[i] = { ...n[i], machineId: e.target.value };
                onChange(n);
              }}
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.calculatedHourlyRateNet?.toFixed(2)} €/h)</option>
              ))}
            </select>
          </div>
          <NumberInput
            label="Nutzungsstunden"
            min={0}
            value={item.usageHours}
            onValueChange={(v) => {
              const n = [...list];
              n[i] = { ...n[i], usageHours: v ?? 0 };
              onChange(n);
            }}
          />
          {list.length > 1 && (
            <PositionRemoveButton onRemove={() => onChange(list.filter((_, idx) => idx !== i))} />
          )}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...list,
            {
              machineId: machines[0]?.id,
              description: "Maschineneinsatz",
              usageHours: 0,
              breakageRiskPercent: 15,
            },
          ])
        }
      >
        + Maschine
      </Button>
    </div>
  );
}

function ProcurementEditor({ items, onChange }: { items: CalcData[]; onChange: (items: CalcData[]) => void }) {
  const list = items.length ? items : [{ description: "Beschaffung", purchasingTimeHours: 0, procurementHourlyRateNet: 55 }];

  return (
    <div className="space-y-3">
      {list.map((item, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 border-b pb-3">
          <Input
            label="Beschreibung"
            value={item.description ?? "Beschaffung"}
            onChange={(e) => {
              const n = [...list];
              n[i] = { ...n[i], description: e.target.value };
              onChange(n);
            }}
          />
          <NumberInput
            label="Einkaufszeit (h)"
            min={0}
            value={item.purchasingTimeHours}
            onValueChange={(v) => {
              const n = [...list];
              n[i] = { ...n[i], purchasingTimeHours: v ?? 0 };
              onChange(n);
            }}
          />
          <NumberInput
            label="Bürostundensatz"
            suffix="€"
            min={0}
            value={item.procurementHourlyRateNet}
            onValueChange={(v) => {
              const n = [...list];
              n[i] = { ...n[i], procurementHourlyRateNet: v ?? 0 };
              onChange(n);
            }}
          />
          {list.length > 1 && (
            <PositionRemoveButton
              label={item.description ?? "Beschaffung"}
              onRemove={() => onChange(list.filter((_, idx) => idx !== i))}
            />
          )}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...list, { description: "Weitere Beschaffung", purchasingTimeHours: 0, procurementHourlyRateNet: 55 }])
        }
      >
        + Beschaffungsposition
      </Button>
    </div>
  );
}

function TravelEditor({
  travel,
  calcId,
  onChange,
}: {
  travel: CalcData | null;
  calcId: string;
  onChange: (t: CalcData) => void;
}) {
  const [dest, setDest] = useState(travel?.destinationAddress ?? "Hauptstraße 42, 10115 Berlin");
  const [km, setKm] = useState(travel?.distanceKm ?? 46);
  const [zoneError, setZoneError] = useState("");

  async function calcZone() {
    setZoneError("");
    const distRes = await fetch("/api/travel/calculate-distance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationAddress: dest, manualDistanceKm: km }),
    });
    const distData = await distRes.json();

    const zoneRes = await fetch("/api/travel/calculate-zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        distanceKm: distData.success ? distData.data.distanceKm : km,
        estimatedDriveTimeHours: distData.data?.estimatedDriveTimeHours ?? 0.5,
        selectedZoneId: travel?.selectedZoneId ?? undefined,
      }),
    });
    const zoneData = await zoneRes.json();
    if (!zoneData.success) {
      setZoneError(zoneData.error ?? "Zone konnte nicht berechnet werden.");
      return;
    }
    if (zoneData.data.noZone) {
      setZoneError("Für diese Entfernung konnte keine Anfahrtszone bestimmt werden. Bitte dem Kundenstandort eine Zone zuordnen oder unter Kalkulation → Zonen eine passende Zone anlegen.");
    }
    onChange({
      startAddress: distData.data?.startAddress ?? "",
      destinationAddress: dest,
      distanceKm: distData.data?.distanceKm ?? km,
      estimatedDriveTimeHours: distData.data?.estimatedDriveTimeHours ?? 0,
      zoneName: zoneData.data.zoneName,
      totalNet: zoneData.data.total,
      kilometerRateNet: 0.45,
      travelHourlyRateNet: 45,
    });
    setKm(distData.data?.distanceKm ?? km);
  }

  const noZone = travel?.zoneName === "Keine Zone";

  return (
    <div className="space-y-3">
      <Input label="Zieladresse" value={dest} onChange={(e) => setDest(e.target.value)} />
      <NumberInput label="Entfernung km (manuell korrigierbar)" min={0} value={km} onValueChange={(v) => setKm(v ?? 0)} />
      <Button variant="outline" onClick={calcZone}>Entfernung & Zone berechnen</Button>
      {zoneError && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{zoneError}</div>
      )}
      {travel?.zoneName && !noZone && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Zone: <strong>{travel.zoneName}</strong> · {travel.calculationMode === "FORMULA" ? "Formel" : "Pauschale"} · {formatEuro(travel.totalNet ?? 0)}
        </div>
      )}
      {noZone && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Keine Anfahrtszone zugeordnet – Anfahrtskosten aktuell 0 €. Bitte dem Kundenstandort eine Zone zuweisen.
        </div>
      )}
    </div>
  );
}
