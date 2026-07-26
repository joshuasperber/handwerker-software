"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { PackageMinus } from "lucide-react";
import { toast } from "sonner";
import {
  WITHDRAWAL_REASONS,
  calcDocumentedUnitMargin,
  isSaleLikeReason,
} from "@/lib/inventory/reasons";
import { formatEuro } from "@/lib/utils";
import { useSession } from "@/components/auth/can-access";

export interface WithdrawArticle {
  id: string;
  name: string;
  unit: string;
  purchasePriceNet?: number | null;
  salesPriceNet?: number | null;
  stockBalances?: { storageLocationId: string; onHandQuantity: number }[];
}

interface LocationOption {
  id: string;
  name: string;
  locationType: string;
}

interface StockWithdrawDialogProps {
  article: WithdrawArticle | null;
  locations: LocationOption[];
  defaultLocationId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type EmployeeOpt = { id: string; user: { firstName: string; lastName: string } };
type CustomerOpt = { id: string; firstName: string; lastName: string };
type OrderOpt = { id: string; orderNumber: string; customer?: { firstName: string; lastName: string } };

function todayInputValue() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function StockWithdrawDialogContent({
  article,
  locations,
  defaultLocationId,
  onClose,
  onSuccess,
}: {
  article: WithdrawArticle;
  locations: LocationOption[];
  defaultLocationId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const session = useSession();
  const isAdmin = session.role === "ADMIN";
  const haupt = locations.find((l) => l.locationType === "HAUPTLAGER");

  const [locationId, setLocationId] = useState(
    defaultLocationId ?? haupt?.id ?? locations[0]?.id ?? ""
  );
  const [quantity, setQuantity] = useState<number | null>(1);
  const [reason, setReason] = useState<string>("VERKAUF");
  const [occurredAt, setOccurredAt] = useState(todayInputValue());
  const [employeeId, setEmployeeId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [purchasePriceNet, setPurchasePriceNet] = useState<number | null>(
    article.purchasePriceNet ?? null
  );
  const [salePriceNet, setSalePriceNet] = useState<number | null>(
    article.salesPriceNet ?? null
  );
  const [notes, setNotes] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [orders, setOrders] = useState<OrderOpt[]>([]);

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setEmployees(d.data);
      })
      .catch(() => {});
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCustomers(d.data);
      })
      .catch(() => {});
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setOrders((d.data as OrderOpt[]).slice(0, 80));
      })
      .catch(() => {});
  }, []);

  const onHand =
    article.stockBalances?.find((b) => b.storageLocationId === locationId)?.onHandQuantity ?? 0;

  const showSaleFields = isSaleLikeReason(reason);
  const unitMargin = useMemo(
    () => calcDocumentedUnitMargin(purchasePriceNet, salePriceNet),
    [purchasePriceNet, salePriceNet]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId || quantity == null || quantity <= 0) {
      setMsg("Bitte eine gültige Menge eingeben.");
      return;
    }
    if (quantity > onHand && !allowNegative) {
      setMsg(
        `Zu wenig Bestand: nur ${onHand} ${article.unit} an diesem Lager. ${
          isAdmin ? "Als Admin können Sie negatives Lager bewusst erlauben." : ""
        }`
      );
      return;
    }

    setSaving(true);
    setMsg("");
    const res = await fetch("/api/stock/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleId: article.id,
        storageLocationId: locationId,
        quantity,
        reason,
        occurredAt: new Date(`${occurredAt}T12:00:00`).toISOString(),
        employeeId: employeeId || undefined,
        orderId: orderId || undefined,
        customerId: customerId || undefined,
        purchasePriceNet,
        salePriceNet: showSaleFields ? salePriceNet : undefined,
        notes: notes.trim() || undefined,
        allowNegative: isAdmin && allowNegative,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      toast.success(data.data.message ?? "Entnahme gebucht");
      onSuccess();
      onClose();
    } else {
      setMsg(data.error ?? "Entnahme fehlgeschlagen");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <PackageMinus className="h-5 w-5 text-[#0d5c63]" /> Entnahme
        </h3>
        <p className="text-sm text-slate-600">
          <span className="font-medium">{article.name}</span>
          <span className="text-slate-400"> · Einheit: {article.unit}</span>
        </p>

        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Lagerort</label>
            <select
              className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Bestand hier: {onHand} {article.unit}
            </p>
          </div>

          <NumberInput
            label={`Menge (${article.unit})`}
            min={0}
            required
            value={quantity}
            onValueChange={setQuantity}
          />
          <div>
            <label className="text-sm font-medium">Datum</label>
            <input
              type="date"
              className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Grund der Entnahme</label>
            <select
              className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {WITHDRAWAL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Entnommen von (Mitarbeiter)</label>
            <select
              className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">— optional —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.user.firstName} {e.user.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Auftrag (optional)</label>
            <select
              className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            >
              <option value="">—</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber}
                  {o.customer ? ` · ${o.customer.lastName}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Kunde (optional)</label>
            <select
              className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.lastName}, {c.firstName}
                </option>
              ))}
            </select>
          </div>

          <NumberInput
            label="Einkaufspreis / Lagerwert"
            suffix="€"
            min={0}
            value={purchasePriceNet}
            onValueChange={setPurchasePriceNet}
          />
          {showSaleFields ? (
            <NumberInput
              label="Verkaufs-/Weitergabepreis"
              suffix="€"
              min={0}
              value={salePriceNet}
              onValueChange={setSalePriceNet}
            />
          ) : (
            <div className="text-xs text-slate-400 flex items-end pb-2">
              Verkaufspreis nur bei Verkauf/Weitergabe
            </div>
          )}

          {showSaleFields && unitMargin != null && (
            <div className="sm:col-span-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
              <p className="text-slate-600">
                Dokumentierte Differenz je {article.unit}:{" "}
                <span className={unitMargin >= 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
                  {formatEuro(unitMargin)}
                </span>
                {quantity != null && quantity > 0 && (
                  <>
                    {" "}
                    · gesamt{" "}
                    <span className="font-semibold">
                      {formatEuro(Math.round(unitMargin * quantity * 100) / 100)}
                    </span>
                  </>
                )}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Nur Dokumentation — keine automatische steuerliche Bewertung.
              </p>
            </div>
          )}

          <div className="sm:col-span-2">
            <Textarea
              label="Notiz (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {isAdmin && (
            <label className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="mt-1"
                checked={allowNegative}
                onChange={(e) => setAllowNegative(e.target.checked)}
              />
              <span>
                Negativen Bestand bewusst erlauben (nur Admin). Ohne Haken erscheint bei zu
                wenig Lager eine Warnung.
              </span>
            </label>
          )}

          {msg && <p className="sm:col-span-2 text-sm text-red-600">{msg}</p>}

          <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Abbrechen
            </Button>
            <Button type="submit" variant="action" disabled={saving}>
              {saving ? "Wird gebucht…" : "Entnahme bestätigen"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function StockWithdrawDialog({
  article,
  locations,
  defaultLocationId,
  onClose,
  onSuccess,
}: StockWithdrawDialogProps) {
  if (!article) return null;
  return (
    <StockWithdrawDialogContent
      key={`${article.id}:${defaultLocationId ?? ""}`}
      article={article}
      locations={locations}
      defaultLocationId={defaultLocationId}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
