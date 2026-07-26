"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { InvoiceActionMode } from "@/lib/documents/invoice-lifecycle";

export interface ExistingInvoiceInfo {
  id: string;
  documentNumber: string;
  status: string;
  sentAt?: string | Date | null;
  paidAmount?: number | null;
  editable: boolean;
  blockReason?: string | null;
}

interface InvoiceConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: ExistingInvoiceInfo | null;
  loading?: boolean;
  onChoose: (mode: InvoiceActionMode) => void;
}

export function InvoiceConflictDialog({
  open,
  onOpenChange,
  invoice,
  loading,
  onChoose,
}: InvoiceConflictDialogProps) {
  const editable = Boolean(invoice?.editable);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rechnung existiert bereits</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            Für diesen Auftrag existiert bereits eine Rechnung. Möchtest du die bestehende
            Rechnung bearbeiten oder bewusst eine neue Rechnung/Korrekturrechnung erstellen?
          </p>
          {invoice && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-900">{invoice.documentNumber}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Status: {invoice.status}
                {invoice.sentAt ? " · versendet" : ""}
                {(invoice.paidAmount ?? 0) > 0 ? " · (teil-)bezahlt" : ""}
              </p>
              {!editable && invoice.blockReason && (
                <p className="text-xs text-amber-800 mt-2">{invoice.blockReason}</p>
              )}
            </div>
          )}
          {!editable && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Diese Rechnung ist finalisiert, versendet oder bezahlt und wird nicht still
              überschrieben. Wähle bewusst eine Korrekturrechnung – oder storniere die alte
              Rechnung unter Rechnungen, falls nötig.
            </p>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {editable ? (
            <>
              <Button
                variant="action"
                className="w-full"
                disabled={loading}
                onClick={() => onChoose("update")}
              >
                Bestehende Rechnung bearbeiten
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => onChoose("create")}
              >
                Neue Rechnung erstellen
              </Button>
            </>
          ) : (
            <Button
              variant="action"
              className="w-full"
              disabled={loading}
              onClick={() => onChoose("correction")}
            >
              Korrekturrechnung erstellen
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
