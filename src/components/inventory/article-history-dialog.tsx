"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { History, X } from "lucide-react";
import {
  MOVEMENT_TYPE_LABELS,
  REASON_LABELS,
} from "@/lib/inventory/reasons";
import { formatEuro } from "@/lib/utils";

interface HistoryMovement {
  id: string;
  movementType: string;
  reason: string | null;
  quantity: number;
  purchasePriceNet: number | null;
  salePriceNet: number | null;
  supplierName: string | null;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
  documentedUnitMargin: number | null;
  documentedTotalMargin: number | null;
  hasReceipt: boolean;
  article: { name: string; unit: string };
  storageLocation: { name: string; locationType: string };
  order: { id: string; orderNumber: string } | null;
  customer: { id: string; firstName: string; lastName: string } | null;
  employee: { id: string; user: { firstName: string; lastName: string } } | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
}

interface ArticleHistoryDialogProps {
  articleId: string | null;
  articleName?: string;
  onClose: () => void;
}

export function ArticleHistoryDialog({
  articleId,
  articleName,
  onClose,
}: ArticleHistoryDialogProps) {
  const [movements, setMovements] = useState<HistoryMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    setError("");
    fetch(`/api/stock/movements?articleId=${articleId}&limit=100`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMovements(d.data);
        else setError(d.error ?? "Historie konnte nicht geladen werden.");
      })
      .catch(() => setError("Historie konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [articleId]);

  if (!articleId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-[#0d5c63]" /> Artikelhistorie
            </h3>
            {articleName && (
              <p className="text-sm text-slate-500 mt-0.5">{articleName}</p>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto p-5 flex-1">
          {loading && <p className="text-sm text-slate-500 text-center py-8">Laden…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && movements.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">Noch keine Bewegungen.</p>
          )}
          {!loading && movements.length > 0 && (
            <div className="space-y-3">
              {movements.map((m) => {
                const isIn = m.movementType === "ZUGANG" || m.movementType === "RUECKGABE";
                const reasonLabel = m.reason
                  ? REASON_LABELS[m.reason] ?? m.reason
                  : MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType;
                const who =
                  m.employee
                    ? `${m.employee.user.firstName} ${m.employee.user.lastName}`
                    : m.createdBy
                      ? `${m.createdBy.firstName} ${m.createdBy.lastName}`
                      : null;
                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-slate-100 p-3 sm:p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                      <div>
                        <p className="font-medium text-sm">
                          <span
                            className={
                              isIn ? "text-green-700" : "text-red-700"
                            }
                          >
                            {isIn ? "+" : "−"}
                            {m.quantity} {m.article.unit}
                          </span>
                          <span className="text-slate-400 mx-1.5">·</span>
                          {reasonLabel}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(m.occurredAt ?? m.createdAt).toLocaleString("de-DE")}
                          {" · "}
                          {m.storageLocation.name}
                          {who ? ` · ${who}` : ""}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 shrink-0">
                        {MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType}
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                      {m.purchasePriceNet != null && (
                        <span>EK {formatEuro(m.purchasePriceNet)}</span>
                      )}
                      {m.salePriceNet != null && (
                        <span>VK {formatEuro(m.salePriceNet)}</span>
                      )}
                      {m.documentedTotalMargin != null && (
                        <span
                          className={
                            m.documentedTotalMargin >= 0
                              ? "text-green-700"
                              : "text-red-700"
                          }
                        >
                          Diff. {formatEuro(m.documentedTotalMargin)}
                        </span>
                      )}
                      {m.supplierName && <span>Lieferant: {m.supplierName}</span>}
                      {m.order && <span>Auftrag {m.order.orderNumber}</span>}
                      {m.customer && (
                        <span>
                          Kunde {m.customer.firstName} {m.customer.lastName}
                        </span>
                      )}
                      {m.hasReceipt && <span>Beleg vorhanden</span>}
                    </div>
                    {m.notes && (
                      <p className="text-xs text-slate-400 italic mt-1">{m.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
