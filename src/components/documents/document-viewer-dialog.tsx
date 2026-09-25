"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { downloadBlob, fetchDocumentPdf, type PdfSource } from "@/lib/documents/export-pdf-client";
import { fetchJson } from "@/lib/fetch-json";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Mail,
  ArrowLeft,
  LayoutTemplate,
} from "lucide-react";

export interface DocumentViewerState {
  open: boolean;
  title: string;
  html: string | null;
  documentId: string | null;
  documentNumber: string | null;
  orderId: string | null;
  calculationId: string | null;
}

const EMPTY: DocumentViewerState = {
  open: false,
  title: "Vorschau",
  html: null,
  documentId: null,
  documentNumber: null,
  orderId: null,
  calculationId: null,
};

export function useDocumentViewer() {
  const [state, setState] = useState<DocumentViewerState>(EMPTY);

  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const openHtml = useCallback(
    (html: string, opts?: { title?: string; documentId?: string; documentNumber?: string; orderId?: string; calculationId?: string }) => {
      setState({
        open: true,
        title: opts?.title ?? "Vorschau",
        html,
        documentId: opts?.documentId ?? null,
        documentNumber: opts?.documentNumber ?? null,
        orderId: opts?.orderId ?? null,
        calculationId: opts?.calculationId ?? null,
      });
    },
    []
  );

  const openDocument = useCallback(
    (doc: { id: string; documentNumber?: string | null; orderId?: string | null; calculationId?: string | null; title?: string }) => {
      setState({
        open: true,
        title: doc.title ?? doc.documentNumber ?? "Dokument",
        html: null,
        documentId: doc.id,
        documentNumber: doc.documentNumber ?? null,
        orderId: doc.orderId ?? null,
        calculationId: doc.calculationId ?? null,
      });
    },
    []
  );

  return { state, close, openHtml, openDocument };
}

interface DocumentViewerDialogProps {
  state: DocumentViewerState;
  onOpenChange: (open: boolean) => void;
}

export function DocumentViewerDialog({ state, onOpenChange }: DocumentViewerDialogProps) {
  const [html, setHtml] = useState<string | null>(state.html);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<"html" | "pdf">("html");
  const [busy, setBusy] = useState<"load" | "pdf" | "save" | null>(null);
  const [layoutConfirm, setLayoutConfirm] = useState(false);
  const [loadedNumber, setLoadedNumber] = useState<string | null>(state.documentNumber);
  const [loadedOrderId, setLoadedOrderId] = useState<string | null>(state.orderId);
  const [loadedCalcId, setLoadedCalcId] = useState<string | null>(state.calculationId);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Neuer Dialogzustand initialisiert die lokale Vorschau.
    setHtml(state.html);
    setMode("html");
    setLoadedNumber(state.documentNumber);
    setLoadedOrderId(state.orderId);
    setLoadedCalcId(state.calculationId);
  }, [state.html, state.documentNumber, state.orderId, state.calculationId, state.open]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (!state.open || !state.documentId || state.html) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Ladeindikator gehört zum durch das Öffnen gestarteten Request.
    setBusy("load");
    fetchJson<{ html: string | null; document: { documentNumber: string; orderId: string | null; calculationId: string } }>(
      `/api/documents/${state.documentId}`
    ).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setHtml(res.data.html);
        setLoadedNumber(res.data.document.documentNumber);
        setLoadedOrderId(res.data.document.orderId);
        setLoadedCalcId(res.data.document.calculationId);
      } else {
        toast.error(res.error ?? "Dokument konnte nicht geladen werden");
      }
      setBusy(null);
    });
    return () => {
      cancelled = true;
    };
  }, [state.open, state.documentId, state.html]);

  async function runPdf(opts: { download?: boolean; source?: PdfSource; save?: boolean; view?: boolean }) {
    if (!state.documentId) {
      toast.error("Bitte zuerst die Rechnung speichern, um ein PDF zu erzeugen.");
      return;
    }
    setBusy(opts.save ? "save" : "pdf");
    try {
      const { blob, filename } = await fetchDocumentPdf(state.documentId, {
        download: opts.download,
        source: opts.source,
        save: opts.save,
      });
      if (opts.save && !opts.download && !opts.view) {
        toast.success("PDF wurde gespeichert. Es wurde keine E-Mail versendet.");
        return;
      }
      if (opts.download) {
        downloadBlob(blob, filename);
        toast.success("PDF wird heruntergeladen. Es wurde keine E-Mail versendet.");
        return;
      }
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setMode("pdf");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF konnte nicht erzeugt werden");
    } finally {
      setBusy(null);
    }
  }

  const canPdf = Boolean(state.documentId);
  const filenameLabel = loadedNumber ?? "Dokument";

  return (
    <>
      <Dialog open={state.open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex max-h-[min(94vh,960px)] w-[min(100%-1rem,960px)] max-w-none flex-col gap-3 overflow-hidden p-3 sm:max-w-[960px] sm:p-4"
          showCloseButton
        >
          <DialogHeader className="pr-8">
            <DialogTitle>{state.title}</DialogTitle>
            <DialogDescription>
              {canPdf
                ? "Vorschau der gespeicherten Rechnung. Beträge stammen aus dem Beleg, das Design aus dem Snapshot zum Erstellzeitpunkt."
                : "Vorschau mit den aktuellen Einstellungen. Noch nicht als Beleg gespeichert."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === "html" ? "action" : "outline"}
              size="sm"
              onClick={() => setMode("html")}
              disabled={!html}
            >
              <Eye className="mr-1 h-4 w-4" />
              Vorschau
            </Button>
            <Button
              type="button"
              variant={mode === "pdf" ? "action" : "outline"}
              size="sm"
              disabled={!canPdf || busy === "pdf"}
              onClick={() => runPdf({ view: true, source: "snapshot" })}
            >
              {busy === "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
              PDF anzeigen
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPdf || busy === "pdf"}
              onClick={() => runPdf({ download: true, source: "snapshot" })}
            >
              <Download className="mr-1 h-4 w-4" />
              PDF herunterladen
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPdf || busy === "pdf"}
              onClick={() => runPdf({ view: true, source: "snapshot" })}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              PDF erneut erzeugen
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPdf || busy === "save"}
              onClick={() => runPdf({ save: true, source: "snapshot" })}
            >
              {busy === "save" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              PDF speichern
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPdf}
              onClick={() => setLayoutConfirm(true)}
            >
              <LayoutTemplate className="mr-1 h-4 w-4" />
              Mit aktuellem Layout
            </Button>
            <Button type="button" variant="outline" size="sm" disabled title="E-Mail-Versand folgt später und wird nicht automatisch ausgelöst.">
              <Mail className="mr-1 h-4 w-4" />
              E-Mail (später)
            </Button>
          </div>

          <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {busy === "load" || busy === "pdf" ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm text-slate-600">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {busy === "pdf" ? "PDF wird erzeugt …" : "Vorschau wird geladen …"}
              </div>
            ) : null}
            {mode === "pdf" && pdfUrl ? (
              <iframe title={`${filenameLabel} als PDF`} src={pdfUrl} className="h-[min(70vh,640px)] w-full bg-white" />
            ) : html ? (
              <iframe title={state.title} srcDoc={html} className="h-[min(70vh,640px)] w-full bg-white" />
            ) : (
              <p className="p-6 text-sm text-slate-500">Keine Vorschau vorhanden.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Schließen
            </Button>
            <Link href="/dashboard" className="text-sm text-[#0d5c63] hover:underline">
              Zum Dashboard
            </Link>
            <Link href="/dashboard/rechnungen" className="text-sm text-[#0d5c63] hover:underline">
              Zu den Rechnungen
            </Link>
            {loadedOrderId ? (
              <Link href={`/dashboard/auftraege/${loadedOrderId}`} className="text-sm text-[#0d5c63] hover:underline">
                Zum Auftrag
              </Link>
            ) : null}
            {loadedCalcId ? (
              <Link href={`/dashboard/kalkulation/${loadedCalcId}`} className="text-sm text-[#0d5c63] hover:underline">
                Zur Kalkulation
              </Link>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={layoutConfirm}
        onOpenChange={setLayoutConfirm}
        title="Mit aktuellem Layout exportieren?"
        description="Beträge und Positionen bleiben wie auf der ursprünglichen Rechnung. Logo, Farben, Texte und Bankverbindung kommen aus den heutigen Rechnungseinstellungen. Der gespeicherte Beleg selbst wird nicht überschrieben."
        confirmLabel="Mit aktuellem Layout anzeigen"
        onConfirm={async () => {
          setLayoutConfirm(false);
          await runPdf({ view: true, source: "current" });
        }}
      />
    </>
  );
}
