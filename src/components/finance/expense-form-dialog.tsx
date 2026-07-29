"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPENSE_CATEGORY_LABELS, type ExpenseDTO } from "@/lib/finance/types";
import { parseExpenseAmount, resolveExpenseAmounts } from "@/lib/finance/amounts";
import { saveJson } from "@/lib/save-toast";
import { fetchJson } from "@/lib/fetch-json";
import { toast } from "sonner";
import { Camera, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const NONE = "__none__";

type OrderOpt = { id: string; orderNumber: string; title: string };
type ProjectOpt = { id: string; name: string };

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Vorhandene Ausgabe zum Bearbeiten */
  expense?: ExpenseDTO | null;
}

function todayLocalInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function RequiredMark() {
  return (
    <span className="text-rose-600" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  onSaved,
  expense = null,
}: ExpenseFormDialogProps) {
  const isEdit = Boolean(expense?.id);
  const [category, setCategory] = useState<string>("MATERIAL");
  const [description, setDescription] = useState("");
  const [netAmount, setNetAmount] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayLocalInput);
  const [paymentStatus, setPaymentStatus] = useState("BEZAHLT");
  const [supplier, setSupplier] = useState("");
  const [orderId, setOrderId] = useState(NONE);
  const [projectId, setProjectId] = useState(NONE);
  const [internalNote, setInternalNote] = useState("");
  const [isInvestment, setIsInvestment] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [orders, setOrders] = useState<OrderOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setCategory("MATERIAL");
    setDescription("");
    setNetAmount("");
    setVatAmount("");
    setGrossAmount("");
    setExpenseDate(todayLocalInput());
    setPaymentStatus("BEZAHLT");
    setSupplier("");
    setOrderId(NONE);
    setProjectId(NONE);
    setInternalNote("");
    setIsInvestment(false);
    setReceiptFile(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }
    if (expense) {
      setCategory(expense.category);
      setDescription(expense.description);
      setNetAmount(String(expense.netAmount));
      setVatAmount(String(expense.vatAmount));
      setGrossAmount(String(expense.grossAmount));
      setExpenseDate(expense.expenseDate.slice(0, 10));
      setPaymentStatus(expense.paymentStatus);
      setSupplier(expense.supplier ?? "");
      setOrderId(expense.orderId ?? NONE);
      setProjectId(expense.projectId ?? NONE);
      setInternalNote(expense.internalNote ?? "");
      setIsInvestment(expense.isInvestment);
      setReceiptFile(null);
    } else {
      resetForm();
    }
  }, [open, expense, resetForm]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      const [ordersRes, projectsRes] = await Promise.all([
        fetchJson<OrderOpt[]>("/api/orders"),
        fetchJson<Array<{ id: string; name: string }>>("/api/projects"),
      ]);
      if (cancelled) return;
      if (ordersRes.success && ordersRes.data) {
        setOrders(ordersRes.data.slice(0, 80));
      }
      if (projectsRes.success && projectsRes.data) {
        setProjects(
          projectsRes.data.slice(0, 80).map((p) => ({ id: p.id, name: p.name }))
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const updateFromNet = (net: string, vat: string) => {
    const n = parseExpenseAmount(net) ?? 0;
    const v = parseExpenseAmount(vat) ?? 0;
    setGrossAmount((n + v).toFixed(2));
  };

  const updateFromGross = (gross: string, vat: string) => {
    const g = parseExpenseAmount(gross);
    if (g == null) return;
    const v = parseExpenseAmount(vat) ?? 0;
    setNetAmount(Math.max(0, g - v).toFixed(2));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Bitte eine Beschreibung eingeben.");
      return;
    }
    if (!expenseDate.trim()) {
      toast.error("Bitte ein Datum wählen.");
      return;
    }

    const amounts = resolveExpenseAmounts(netAmount, vatAmount, grossAmount);
    if (!amounts) {
      toast.error("Bitte Betrag netto oder brutto eingeben (nicht negativ).");
      return;
    }

    // Sichtbar synchronisieren, falls Netto aus Brutto abgeleitet wurde
    setNetAmount(amounts.net.toFixed(2));
    setVatAmount(amounts.vat.toFixed(2));
    setGrossAmount(amounts.gross.toFixed(2));

    setSaving(true);
    try {
      const payload = {
        category,
        description: description.trim(),
        netAmount: amounts.net,
        vatAmount: amounts.vat,
        grossAmount: amounts.gross,
        // yyyy-MM-dd — Server parst lokal mittags (kein UTC-Tageswechsel)
        expenseDate,
        paymentStatus,
        supplier: supplier.trim() || null,
        orderId: orderId === NONE ? null : orderId,
        projectId: projectId === NONE ? null : projectId,
        internalNote: internalNote.trim() || null,
        isInvestment,
      };

      let expenseId: string | null = isEdit && expense ? expense.id : null;
      let savedOk = false;

      if (isEdit && expense) {
        const result = await saveJson(
          `/api/finance/expenses/${expense.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
          { success: "Ausgabe aktualisiert" }
        );
        savedOk = Boolean(result.success);
      } else {
        // Immer zuerst JSON speichern — Beleg danach separat, damit Speicherfehler den Beleg nicht blockieren
        const result = await saveJson<{ id: string }>(
          "/api/finance/expenses",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
          { success: "Ausgabe gespeichert" }
        );
        savedOk = Boolean(result.success);
        if (result.success && result.data?.id) {
          expenseId = result.data.id;
        }
      }

      if (savedOk && receiptFile && expenseId) {
        const formData = new FormData();
        formData.append("receipt", receiptFile);
        const receiptResult = await saveJson(
          `/api/finance/expenses/${expenseId}/receipt`,
          { method: "POST", body: formData },
          {
            success: "Beleg hochgeladen",
            error: "Ausgabe gespeichert, Beleg-Upload fehlgeschlagen",
          }
        );
        if (!receiptResult.success) {
          // Ausgabe bleibt gespeichert — Nutzer kann Beleg später nachreichen
          toast.message("Ausgabe ist gespeichert. Beleg bitte später erneut hochladen.");
        }
      }

      if (savedOk) {
        onOpenChange(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = async () => {
    if (!expense?.id) return;
    setWithdrawing(true);
    try {
      const result = await saveJson(
        `/api/finance/expenses/${expense.id}`,
        { method: "DELETE" },
        {
          loading: "Ausgabe wird zurückgezogen …",
          success: "Ausgabe zurückgezogen",
          error: "Zurückziehen fehlgeschlagen",
        }
      );
      if (result.success) {
        onOpenChange(false);
        onSaved();
      }
    } finally {
      setWithdrawing(false);
    }
  };

  const busy = saving || withdrawing;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ausgabe bearbeiten" : "Ausgabe erfassen"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>
              Kategorie
              <RequiredMark />
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-desc">
              Beschreibung
              <RequiredMark />
            </Label>
            <Input
              id="exp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z. B. Baumarkt Material, Tankbeleg"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="exp-net">
                Betrag netto (€)
                <RequiredMark />
              </Label>
              <Input
                id="exp-net"
                inputMode="decimal"
                value={netAmount}
                onChange={(e) => {
                  setNetAmount(e.target.value);
                  updateFromNet(e.target.value, vatAmount);
                }}
                placeholder="0,00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-vat">Umsatzsteuer (€)</Label>
              <Input
                id="exp-vat"
                inputMode="decimal"
                value={vatAmount}
                onChange={(e) => {
                  setVatAmount(e.target.value);
                  updateFromNet(netAmount, e.target.value);
                }}
                placeholder="0,00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-gross">Betrag brutto (€)</Label>
              <Input
                id="exp-gross"
                inputMode="decimal"
                value={grossAmount}
                onChange={(e) => {
                  setGrossAmount(e.target.value);
                  updateFromGross(e.target.value, vatAmount);
                }}
                placeholder="0,00"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 -mt-2">
            Netto oder Brutto reicht — fehlende Werte werden automatisch berechnet.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="exp-date">
                Datum
                <RequiredMark />
              </Label>
              <Input
                id="exp-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>
                Zahlungsstatus
                <RequiredMark />
              </Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEZAHLT">Bezahlt</SelectItem>
                  <SelectItem value="OFFEN">Offen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-supplier">Lieferant / Händler</Label>
            <Input
              id="exp-supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="optional"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Bezug zu Auftrag</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Kein Auftrag</SelectItem>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.orderNumber}
                      {o.title ? ` · ${o.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Bezug zu Projekt</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Kein Projekt</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-note">Notiz</Label>
            <Textarea
              id="exp-note"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={2}
              placeholder="optional"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isInvestment}
              onChange={(e) => setIsInvestment(e.target.checked)}
              className="rounded border-slate-300"
            />
            Größere Anschaffung / Investition
          </label>

          <div className="grid gap-2">
            <Label>Beleg-Upload (Foto oder PDF)</Label>
            {expense?.hasReceipt && !receiptFile && (
              <p className="text-xs text-emerald-700">Beleg vorhanden — optional neu hochladen</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Datei wählen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 sm:hidden"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                Foto aufnehmen
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
            {receiptFile && (
              <p className="text-xs text-slate-500">{receiptFile.name}</p>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Pflichtfelder sind mit <span className="text-rose-600">*</span> markiert.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          {isEdit ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmWithdraw(true)}
              disabled={busy}
              className="w-full sm:w-auto sm:mr-auto"
            >
              {withdrawing ? "Zurückziehen…" : "Zurückziehen"}
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
              disabled={busy}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={busy} className="w-full sm:w-auto">
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={confirmWithdraw}
      onOpenChange={setConfirmWithdraw}
      title="Ausgabe zurückziehen?"
      description={
        expense
          ? `Ausgabe „${expense.description}“ wird zurückgezogen. Das kann nicht rückgängig gemacht werden.`
          : ""
      }
      confirmLabel="Zurückziehen"
      cancelLabel="Abbrechen"
      variant="destructive"
      loading={withdrawing}
      onConfirm={async () => {
        setConfirmWithdraw(false);
        await handleWithdraw();
      }}
    />
    </>
  );
}
