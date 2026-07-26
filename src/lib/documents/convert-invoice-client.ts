import type { InvoiceActionMode } from "@/lib/documents/invoice-lifecycle";
import type { ExistingInvoiceInfo } from "@/components/documents/invoice-conflict-dialog";

export type ConvertInvoiceResult =
  | {
      ok: true;
      action: "created" | "updated" | "correction" | "preview";
      document?: { id: string; documentNumber: string };
      documentNumber?: string;
      html?: string;
      breakdownHtml?: string;
      orderUpdated?: boolean;
    }
  | {
      ok: false;
      conflict: true;
      message: string;
      invoice: ExistingInvoiceInfo;
      invoices: ExistingInvoiceInfo[];
    }
  | {
      ok: false;
      conflict: false;
      message: string;
    };

export async function convertCalculationToInvoice(
  calculationId: string,
  options: {
    preview?: boolean;
    mode?: InvoiceActionMode;
    documentId?: string;
  } = {}
): Promise<ConvertInvoiceResult> {
  const res = await fetch(`/api/calculations/${calculationId}/convert-to-invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      preview: options.preview === true,
      mode: options.mode,
      documentId: options.documentId,
    }),
  });
  const d = await res.json();

  if (res.status === 409 && d?.data?.code === "INVOICE_EXISTS" && d.data.invoice) {
    return {
      ok: false,
      conflict: true,
      message: d.error ?? "Rechnung existiert bereits",
      invoice: d.data.invoice,
      invoices: d.data.invoices ?? [d.data.invoice],
    };
  }

  if (!d.success) {
    // Nicht bearbeitbar → als Konflikt mit Hinweis behandeln, falls Daten vorhanden
    if (d?.data?.code === "INVOICE_NOT_EDITABLE" && d.data.invoice) {
      return {
        ok: false,
        conflict: true,
        message: d.error ?? "Rechnung nicht bearbeitbar",
        invoice: d.data.invoice,
        invoices: d.data.invoices ?? [d.data.invoice],
      };
    }
    return { ok: false, conflict: false, message: d.error ?? "Rechnung fehlgeschlagen" };
  }

  if (options.preview) {
    return {
      ok: true,
      action: "preview",
      documentNumber: d.data.documentNumber,
      html: d.data.html,
      breakdownHtml: d.data.breakdownHtml,
    };
  }

  return {
    ok: true,
    action: d.data.action ?? "created",
    document: d.data.document
      ? { id: d.data.document.id, documentNumber: d.data.document.documentNumber }
      : undefined,
    html: d.data.html,
    breakdownHtml: d.data.breakdownHtml,
    orderUpdated: d.data.orderUpdated,
  };
}
