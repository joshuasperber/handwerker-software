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
import { saveJson } from "@/lib/save-toast";
import { Camera, Upload } from "lucide-react";

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Vorhandene Ausgabe zum Bearbeiten */
  expense?: ExpenseDTO | null;
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
  const [expenseDate, setExpenseDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [paymentStatus, setPaymentStatus] = useState("BEZAHLT");
  const [supplier, setSupplier] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [isInvestment, setIsInvestment] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setCategory("MATERIAL");
    setDescription("");
    setNetAmount("");
    setVatAmount("");
    setGrossAmount("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setPaymentStatus("BEZAHLT");
    setSupplier("");
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
      setInternalNote(expense.internalNote ?? "");
      setIsInvestment(expense.isInvestment);
      setReceiptFile(null);
    } else {
      resetForm();
    }
  }, [open, expense, resetForm]);

  const updateFromNet = (net: string, vat: string) => {
    const n = parseFloat(net.replace(",", ".")) || 0;
    const v = parseFloat(vat.replace(",", ".")) || 0;
    setGrossAmount((n + v).toFixed(2));
  };

  const handleSubmit = async () => {
    const net = parseFloat(netAmount.replace(",", "."));
    const vat = parseFloat(vatAmount.replace(",", ".")) || 0;
    const gross = parseFloat(grossAmount.replace(",", ".")) || net + vat;

    if (!description.trim() || Number.isNaN(net) || net < 0) return;

    setSaving(true);
    const payload = {
      category,
      description: description.trim(),
      netAmount: net,
      vatAmount: vat,
      grossAmount: gross,
      expenseDate: new Date(expenseDate).toISOString(),
      paymentStatus,
      supplier: supplier.trim() || null,
      internalNote: internalNote.trim() || null,
      isInvestment,
    };

    let result;
    if (isEdit && expense) {
      result = await saveJson(
        `/api/finance/expenses/${expense.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        { success: "Ausgabe aktualisiert" }
      );
      if (result.success && receiptFile) {
        const formData = new FormData();
        formData.append("receipt", receiptFile);
        await saveJson(`/api/finance/expenses/${expense.id}/receipt`, {
          method: "POST",
          body: formData,
        }, { success: "Beleg hochgeladen" });
      }
    } else if (receiptFile) {
      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));
      formData.append("receipt", receiptFile);
      result = await saveJson("/api/finance/expenses", { method: "POST", body: formData }, {
        success: "Ausgabe gespeichert",
      });
    } else {
      result = await saveJson(
        "/api/finance/expenses",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        { success: "Ausgabe gespeichert" }
      );
    }

    setSaving(false);
    if (result?.success) {
      onOpenChange(false);
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ausgabe bearbeiten" : "Ausgabe erfassen"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Kategorie</Label>
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
            <Label htmlFor="exp-desc">Beschreibung</Label>
            <Input
              id="exp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z. B. Baumarkt Material, Tankbeleg"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="exp-net">Netto (€)</Label>
              <Input
                id="exp-net"
                inputMode="decimal"
                value={netAmount}
                onChange={(e) => {
                  setNetAmount(e.target.value);
                  updateFromNet(e.target.value, vatAmount);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-vat">MwSt. (€)</Label>
              <Input
                id="exp-vat"
                inputMode="decimal"
                value={vatAmount}
                onChange={(e) => {
                  setVatAmount(e.target.value);
                  updateFromNet(netAmount, e.target.value);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-gross">Brutto (€)</Label>
              <Input
                id="exp-gross"
                inputMode="decimal"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="exp-date">Datum</Label>
              <Input
                id="exp-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Zahlungsstatus</Label>
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
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-note">Interne Notiz</Label>
            <Textarea
              id="exp-note"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={2}
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
            <Label>Beleg (Foto oder PDF)</Label>
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
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
