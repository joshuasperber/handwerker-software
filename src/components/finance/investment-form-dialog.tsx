"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  INVESTMENT_CATEGORY_LABELS,
  INVESTMENT_STATUS_LABELS,
  FINANCE_DISCLAIMERS,
  type PlannedInvestmentDTO,
} from "@/lib/finance/types";
import { saveJson } from "@/lib/save-toast";

interface InvestmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  investment?: PlannedInvestmentDTO | null;
}

export function InvestmentFormDialog({
  open,
  onOpenChange,
  onSaved,
  investment = null,
}: InvestmentFormDialogProps) {
  const isEdit = Boolean(investment?.id);
  const [title, setTitle] = useState("");
  const [plannedAmount, setPlannedAmount] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [category, setCategory] = useState("MACHINE");
  const [status, setStatus] = useState("PLANNED");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setTitle("");
    setPlannedAmount("");
    setPlannedDate("");
    setCategory("MACHINE");
    setStatus("PLANNED");
    setNote("");
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }
    if (investment) {
      setTitle(investment.title);
      setPlannedAmount(String(investment.plannedAmount));
      setPlannedDate(investment.plannedDate ? investment.plannedDate.slice(0, 10) : "");
      setCategory(investment.category);
      setStatus(investment.status);
      setNote(investment.note ?? "");
    } else {
      resetForm();
    }
  }, [open, investment, resetForm]);

  const handleSubmit = async () => {
    const amount = parseFloat(plannedAmount.replace(",", "."));
    if (!title.trim() || Number.isNaN(amount) || amount < 0) return;

    setSaving(true);
    const payload = {
      title: title.trim(),
      plannedAmount: amount,
      plannedDate: plannedDate ? new Date(plannedDate).toISOString() : null,
      category,
      status,
      note: note.trim() || null,
    };

    const result = isEdit && investment
      ? await saveJson(
          `/api/finance/investments/${investment.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
          { success: "Investition aktualisiert" }
        )
      : await saveJson(
          "/api/finance/investments",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
          { success: "Investition gespeichert" }
        );

    setSaving(false);
    if (result?.success) {
      onOpenChange(false);
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Investition bearbeiten" : "Geplante Investition"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="inv-title">Bezeichnung</Label>
            <Input
              id="inv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Neue Akku-Bohrmaschine"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="inv-amount">Geplanter Betrag (€)</Label>
              <Input
                id="inv-amount"
                inputMode="decimal"
                value={plannedAmount}
                onChange={(e) => setPlannedAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-date">Geplantes Kaufdatum</Label>
              <Input
                id="inv-date"
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INVESTMENT_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INVESTMENT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="inv-note">Notiz</Label>
            <Textarea
              id="inv-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          <p className="text-[11px] text-slate-400">{FINANCE_DISCLAIMERS.investment}</p>
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
