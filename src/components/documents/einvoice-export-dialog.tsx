"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatEuro, formatDate } from "@/lib/utils";
import {
  E_INVOICE_FORMATS,
  type EInvoiceFormatId,
  type EInvoiceReadiness,
} from "@/lib/documents/einvoice/types";
import { AlertTriangle, Download, FileCode2, Loader2 } from "lucide-react";

type CheckResponse = EInvoiceReadiness & {
  documentId: string;
  existingFormat: string | null;
  existingGeneratedAt: string | null;
  requestedFormat: EInvoiceFormatId;
  autoEmail: boolean;
};

type Props = {
  open: boolean;
  documentId: string | null;
  documentNumber?: string;
  onOpenChange: (open: boolean) => void;
  onExported?: () => void;
};

export function EInvoiceExportDialog({
  open,
  documentId,
  documentNumber,
  onOpenChange,
  onExported,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [check, setCheck] = useState<CheckResponse | null>(null);
  const [format, setFormat] = useState<EInvoiceFormatId>("ZUGFERD_PDF");

  useEffect(() => {
    if (!open || !documentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Geschlossener Dialog verwirft seinen flüchtigen Prüfzstand.
      setCheck(null);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/documents/${documentId}/einvoice?mode=check&format=${format}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.success) {
          setError(d.error ?? "Prüfung fehlgeschlagen");
          setCheck(null);
          return;
        }
        setCheck(d.data as CheckResponse);
      })
      .catch(() => {
        if (!cancelled) setError("Prüfung fehlgeschlagen");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, documentId, format]);

  async function download() {
    if (!documentId || !check?.valid) return;
    setExporting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/documents/${documentId}/einvoice?mode=download&format=${format}&confirm=1`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Export fehlgeschlagen");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName =
        match?.[1] ??
        `${documentNumber ?? "rechnung"}.${format === "ZUGFERD_PDF" ? "pdf" : "xml"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      onExported?.();
      onOpenChange(false);
    } catch {
      setError("Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5" />
            E-Rechnung prüfen &amp; exportieren
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-600">
          Bestehende Rechnungen werden nicht automatisch umgewandelt. Es wird keine E-Mail
          versendet – Sie laden die Datei herunter und versenden sie bei Bedarf manuell.
        </p>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">Format</p>
          <div className="grid gap-2">
            {E_INVOICE_FORMATS.map((f) => (
              <label
                key={f.id}
                className={`flex items-start gap-2 rounded-lg border p-3 text-sm cursor-pointer ${
                  format === f.id ? "border-[#0d5c63] bg-[#0d5c63]/5" : "border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="einvoice-format"
                  className="mt-1"
                  checked={format === f.id}
                  onChange={() => setFormat(f.id)}
                />
                <span>
                  <span className="font-medium block">{f.label}</span>
                  <span className="text-xs text-slate-500">{f.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Prüfe Rechnungsdaten…
          </div>
        )}

        {error && (
          <p className="text-sm text-rose-600 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {check && !loading && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-slate-500">Empfänger</p>
                <p className="font-medium">{check.preview.buyerName}</p>
                <p className="text-xs text-slate-500">{check.preview.buyerAddress}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Rechnung</p>
                <p className="font-medium">{check.preview.documentNumber}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(check.preview.issueDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Netto</p>
                <p className="font-medium">{formatEuro(check.preview.net)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Steuer / Brutto</p>
                <p className="font-medium">
                  {formatEuro(check.preview.vat)} / {formatEuro(check.preview.gross)}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Steuer: {check.preview.taxTreatment} · Positionen: {check.preview.lineCount}
              <br />
              {check.preview.serviceDateNote}
            </p>
            {check.existingGeneratedAt && (
              <p className="text-xs text-slate-500">
                Zuletzt erzeugt: {formatDate(check.existingGeneratedAt)}
                {check.existingFormat ? ` (${check.existingFormat})` : ""}
              </p>
            )}

            {check.errors.length > 0 && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-2">
                <p className="text-xs font-medium text-rose-800 mb-1">Fehlende Pflichtangaben</p>
                <ul className="list-disc pl-4 text-xs text-rose-700 space-y-0.5">
                  {check.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {check.warnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                <p className="text-xs font-medium text-amber-800 mb-1">Hinweise</p>
                <ul className="list-disc pl-4 text-xs text-amber-800 space-y-0.5">
                  {check.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="action"
            disabled={!check?.valid || exporting || loading}
            onClick={download}
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Erzeuge…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" /> E-Rechnung herunterladen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
