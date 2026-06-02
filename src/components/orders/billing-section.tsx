"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceCompositionPanel } from "@/components/calculation/price-composition";
import { formatEuro } from "@/lib/utils";
import { FileText, Calculator, CheckCircle, Pencil } from "lucide-react";
import { toast } from "sonner";

interface OrderBillingSectionProps {
  orderId: string;
  orderStatus: string;
  calculationId: string | null;
  onCreateCalculation: () => void;
  onInvoiceCreated: () => void;
}

export function OrderBillingSection({
  orderId,
  orderStatus,
  calculationId,
  onCreateCalculation,
  onInvoiceCreated,
}: OrderBillingSectionProps) {
  const [calc, setCalc] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const showBilling = ["ABRECHNUNGSBEREIT", "ABGERECHNET"].includes(orderStatus);

  useEffect(() => {
    if (!calculationId || !showBilling) {
      setCalc(null);
      return;
    }
    fetch(`/api/calculations/${calculationId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setCalc(d.data); });
  }, [calculationId, showBilling]);

  function openHtml(html: string) {
    const w = window.open("", "_blank");
    w?.document.write(html);
    w?.document.close();
  }

  async function previewInvoice() {
    if (!calculationId) return;
    const res = await fetch(`/api/calculations/${calculationId}/convert-to-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preview: true }),
    });
    const d = await res.json();
    if (d.success && d.data.html) openHtml(d.data.html);
  }

  async function previewBreakdown() {
    if (!calculationId) return;
    const res = await fetch("/api/documents/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calculationId, type: "breakdown" }),
    });
    const d = await res.json();
    if (d.success && d.data.html) openHtml(d.data.html);
  }

  const alreadyInvoiced = orderStatus === "ABGERECHNET";

  async function createInvoice() {
    if (!calculationId) return;
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/calculations/${calculationId}/convert-to-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const d = await res.json();
    setLoading(false);
    if (d.success) {
      toast.success(
        alreadyInvoiced
          ? `Korrigierte Rechnung ${d.data.document.documentNumber} erstellt`
          : `Rechnung ${d.data.document.documentNumber} erstellt`,
        { description: "Die Rechnung wurde in einem neuen Tab geöffnet." }
      );
      setMsg(`Rechnung ${d.data.document.documentNumber} erstellt`);
      if (d.data.html) openHtml(d.data.html);
      onInvoiceCreated();
    } else {
      toast.error("Rechnung fehlgeschlagen", { description: d.error ?? "Bitte erneut versuchen." });
      setMsg(d.error ?? "Rechnung fehlgeschlagen");
    }
  }

  if (!showBilling) return null;

  return (
    <Card title="Abrechnung" className="mb-6 border-2 border-emerald-200 bg-emerald-50/30">
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          {orderStatus === "ABRECHNUNGSBEREIT"
            ? "Der Einsatz ist abgeschlossen. Erstellen Sie aus der Kalkulation eine Kundenrechnung mit Name, Adresse, Firmendaten und Leistungspositionen."
            : "Dieser Auftrag wurde bereits abgerechnet."}
        </p>

        {!calculationId ? (
          <div className="rounded-lg bg-white border border-slate-200 p-4">
            <p className="text-sm text-slate-600 mb-3">
              Für die Abrechnung wird zuerst eine Kalkulation aus dem Auftrag benötigt (Leistungen, Material, Fahrt).
            </p>
            <Button variant="action" onClick={onCreateCalculation}>
              <Calculator className="h-4 w-4 mr-1" /> Grundkalkulation anlegen
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-lg font-bold text-[#0d5c63]">
                Netto {formatEuro((calc?.netSalesPrice as number) ?? 0)} · Brutto {formatEuro((calc?.grossSalesPrice as number) ?? 0)}
              </p>
              <Link href={`/dashboard/kalkulation/${calculationId}`} className="text-sm text-[#0d5c63] hover:underline">
                Kalkulation bearbeiten →
              </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <PriceCompositionPanel
                calc={calc as Parameters<typeof PriceCompositionPanel>[0]["calc"]}
                onPreviewInvoice={previewInvoice}
                onPreviewBreakdown={previewBreakdown}
              />
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <h4 className="font-semibold text-slate-900">
                  {alreadyInvoiced ? "Rechnung bearbeiten" : "Rechnung erstellen"}
                </h4>
                {alreadyInvoiced ? (
                  <>
                    <p className="text-sm text-green-700 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Bereits abgerechnet
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Gab es nachträglich weitere Kosten? Passen Sie die Kalkulation an
                      (z. B. zusätzliche Arbeitsstunden oder Material) und erstellen Sie
                      anschließend eine korrigierte Rechnung mit neuer Rechnungsnummer.
                    </p>
                    <Link href={`/dashboard/kalkulation/${calculationId}`}>
                      <Button variant="primary" className="w-full">
                        <Pencil className="h-4 w-4 mr-1" /> Kalkulation bearbeiten
                      </Button>
                    </Link>
                    <Button variant="action" onClick={createInvoice} disabled={loading} className="w-full">
                      <FileText className="h-4 w-4 mr-1" />
                      {loading ? "Erstelle…" : "Korrigierte Rechnung erstellen"}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Enthält: Ihre Firmenadresse (Einstellungen), Logo, Kundenname &amp; Einsatzadresse,
                      Leistungspositionen und die berechnete Summe inkl. versteckter Kostenanteile als Pauschale.
                    </p>
                    <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                      <li>Firmendaten: Kalkulation → Einstellungen</li>
                      <li>Logo: Tenant-Einstellungen (logoUrl)</li>
                      <li>Sichtbare Positionen: in der Kalkulation markieren</li>
                    </ul>
                    <Button variant="action" onClick={createInvoice} disabled={loading} className="w-full">
                      <FileText className="h-4 w-4 mr-1" />
                      {loading ? "Erstelle…" : "Rechnung erstellen & abrechnen"}
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={previewInvoice} className="w-full">
                  Vorschau Kundenrechnung
                </Button>
              </div>
            </div>
          </>
        )}

        {msg && <p className="text-sm text-green-700">{msg}</p>}
      </div>
    </Card>
  );
}
