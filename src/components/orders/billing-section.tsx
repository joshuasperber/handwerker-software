"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PriceCompositionPanel } from "@/components/calculation/price-composition";
import {
  InvoiceConflictDialog,
  type ExistingInvoiceInfo,
} from "@/components/documents/invoice-conflict-dialog";
import { convertCalculationToInvoice } from "@/lib/documents/convert-invoice-client";
import type { InvoiceActionMode } from "@/lib/documents/invoice-lifecycle";
import { formatIssueDateInput } from "@/lib/documents/issue-date";
import { formatEuro } from "@/lib/utils";
import { FileText, Calculator, CheckCircle, Pencil, Download } from "lucide-react";
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
  const [lastDocId, setLastDocId] = useState<string | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictInvoice, setConflictInvoice] = useState<ExistingInvoiceInfo | null>(null);
  const [issueDate, setIssueDate] = useState(() => formatIssueDateInput(new Date()));

  const showBilling = ["ABRECHNUNGSBEREIT", "ABGERECHNET"].includes(orderStatus);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!calculationId || !showBilling) {
        if (active) setCalc(null);
        return;
      }
      const r = await fetch(`/api/calculations/${calculationId}`);
      const d = await r.json();
      if (active && d.success) setCalc(d.data);
    })();
    return () => {
      active = false;
    };
  }, [calculationId, showBilling]);

  function openHtml(html: string) {
    const w = window.open("", "_blank");
    w?.document.write(html);
    w?.document.close();
  }

  async function previewInvoice() {
    if (!calculationId) return;
    const result = await convertCalculationToInvoice(calculationId, { preview: true });
    if (result.ok && result.html) openHtml(result.html);
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

  async function runInvoice(mode?: InvoiceActionMode, documentId?: string) {
    if (!calculationId) return;
    setLoading(true);
    setMsg("");
    const result = await convertCalculationToInvoice(calculationId, {
      mode,
      documentId,
      issueDate,
    });
    setLoading(false);

    if (!result.ok) {
      if (result.conflict) {
        setConflictInvoice(result.invoice);
        setConflictOpen(true);
        return;
      }
      toast.error("Rechnung fehlgeschlagen", { description: result.message });
      setMsg(result.message);
      return;
    }

    setConflictOpen(false);
    const number = result.document?.documentNumber ?? "";
    const label =
      result.action === "updated"
        ? `Rechnung ${number} aktualisiert`
        : result.action === "correction"
          ? `Korrekturrechnung ${number} erstellt`
          : `Rechnung ${number} erstellt`;
    toast.success(label, { description: "Die Rechnung wurde in einem neuen Tab geöffnet." });
    setMsg(label);
    setLastDocId(result.document?.id ?? null);
    if (result.html) openHtml(result.html);
    onInvoiceCreated();
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
                Netto {formatEuro((calc?.netSalesPrice as number) ?? 0)} · Brutto{" "}
                {formatEuro((calc?.grossSalesPrice as number) ?? 0)}
              </p>
              <Link
                href={`/dashboard/kalkulation/${calculationId}`}
                className="text-sm text-[#0d5c63] hover:underline"
              >
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
                <div className="space-y-1.5">
                  <Label htmlFor="order-invoice-issue-date">Rechnungsdatum</Label>
                  <Input
                    id="order-invoice-issue-date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Umsatz wird dem Monat dieses Datums zugeordnet.
                  </p>
                </div>
                {alreadyInvoiced ? (
                  <>
                    <p className="text-sm text-green-700 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Bereits abgerechnet
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Änderungen an der Kalkulation aktualisieren die bestehende Rechnung, sofern
                      sie noch bearbeitbar ist (nicht versendet/bezahlt). Sonst wählen Sie bewusst
                      eine neue Rechnung oder Korrekturrechnung.
                    </p>
                    <Link href={`/dashboard/kalkulation/${calculationId}`}>
                      <Button variant="primary" className="w-full">
                        <Pencil className="h-4 w-4 mr-1" /> Kalkulation bearbeiten
                      </Button>
                    </Link>
                    <Button
                      variant="action"
                      onClick={() => runInvoice()}
                      disabled={loading || !issueDate}
                      className="w-full"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      {loading ? "Speichere…" : "Rechnung speichern / aktualisieren"}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Enthält: Ihre Firmenadresse (Einstellungen), Logo, Kundenname &amp;
                      Einsatzadresse, Leistungspositionen und die berechnete Summe inkl.
                      versteckter Kostenanteile als Pauschale.
                    </p>
                    <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                      <li>Firmendaten: Kalkulation → Einstellungen</li>
                      <li>Logo: Tenant-Einstellungen (logoUrl)</li>
                      <li>Sichtbare Positionen: in der Kalkulation markieren</li>
                    </ul>
                    <Button
                      variant="action"
                      onClick={() => runInvoice()}
                      disabled={loading || !issueDate}
                      className="w-full"
                    >
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

        {lastDocId && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a
              href={`/api/documents/${lastDocId}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="text-[#0d5c63] hover:underline inline-flex items-center gap-1"
            >
              <Download className="h-4 w-4" /> PDF herunterladen
            </a>
            <Link href="/dashboard/rechnungen" className="text-[#0d5c63] hover:underline">
              Zur Rechnungsübersicht →
            </Link>
          </div>
        )}
      </div>

      <InvoiceConflictDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        invoice={conflictInvoice}
        loading={loading}
        onChoose={(mode) =>
          runInvoice(mode, mode === "update" ? conflictInvoice?.id : undefined)
        }
      />
    </Card>
  );
}
