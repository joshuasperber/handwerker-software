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
import {
  CALCULATION_BASIS_LABELS,
  SAVINGS_MODEL_LABELS,
  type InvestmentCalculationBasis,
  type InvestmentSavingsModel,
} from "@/lib/finance/investment-reserve";
import { InvestmentProgress } from "@/components/finance/investment-progress";
import { formatEuro } from "@/lib/utils";
import { saveJson } from "@/lib/save-toast";
import { fetchJson } from "@/lib/fetch-json";

const NONE = "__none__";

type NamedOpt = { id: string; name: string };

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
  const [savedAmount, setSavedAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [savingsModel, setSavingsModel] = useState<InvestmentSavingsModel>("TARGET_SCHEDULE");
  const [percentOfRevenue, setPercentOfRevenue] = useState("");
  const [amountPerOrder, setAmountPerOrder] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [calculationBasis, setCalculationBasis] = useState<InvestmentCalculationBasis>("NET");
  const [machineId, setMachineId] = useState(NONE);
  const [articleId, setArticleId] = useState(NONE);
  const [projectId, setProjectId] = useState(NONE);
  const [machines, setMachines] = useState<NamedOpt[]>([]);
  const [articles, setArticles] = useState<NamedOpt[]>([]);
  const [projects, setProjects] = useState<NamedOpt[]>([]);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setTitle("");
    setPlannedAmount("");
    setPlannedDate("");
    setCategory("MACHINE");
    setStatus("PLANNED");
    setNote("");
    setSavedAmount("");
    setStartDate("");
    setSavingsModel("TARGET_SCHEDULE");
    setPercentOfRevenue("");
    setAmountPerOrder("");
    setMonthlyAmount("");
    setCalculationBasis("NET");
    setMachineId(NONE);
    setArticleId(NONE);
    setProjectId(NONE);
  }, []);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Geschlossener Dialog verwirft den Formularentwurf.
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
      setSavedAmount(String(investment.savedAmount ?? 0));
      setStartDate(investment.startDate ? investment.startDate.slice(0, 10) : "");
      setSavingsModel(investment.savingsModel ?? "TARGET_SCHEDULE");
      setPercentOfRevenue(
        investment.percentOfRevenue != null ? String(investment.percentOfRevenue) : ""
      );
      setAmountPerOrder(investment.amountPerOrder != null ? String(investment.amountPerOrder) : "");
      setMonthlyAmount(investment.monthlyAmount != null ? String(investment.monthlyAmount) : "");
      setCalculationBasis(investment.calculationBasis ?? "NET");
      setMachineId(investment.machineId ?? NONE);
      setArticleId(investment.articleId ?? NONE);
      setProjectId(investment.projectId ?? NONE);
    } else {
      resetForm();
    }
  }, [open, investment, resetForm]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const [machinesRes, articlesRes, projectsRes] = await Promise.all([
        fetchJson<Array<{ id: string; name: string }>>("/api/machines"),
        fetchJson<Array<{ id: string; name: string }>>("/api/articles"),
        fetchJson<Array<{ id: string; name: string }>>("/api/projects"),
      ]);
      if (cancelled) return;
      if (machinesRes.success && Array.isArray(machinesRes.data)) {
        setMachines(machinesRes.data.slice(0, 80).map((m) => ({ id: m.id, name: m.name })));
      }
      if (articlesRes.success && Array.isArray(articlesRes.data)) {
        setArticles(articlesRes.data.slice(0, 80).map((a) => ({ id: a.id, name: a.name })));
      }
      if (projectsRes.success && Array.isArray(projectsRes.data)) {
        setProjects(projectsRes.data.slice(0, 80).map((p) => ({ id: p.id, name: p.name })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSubmit = async () => {
    const amount = parseFloat(plannedAmount.replace(",", "."));
    const saved = parseFloat((savedAmount || "0").replace(",", "."));
    if (!title.trim() || Number.isNaN(amount) || amount < 0 || Number.isNaN(saved) || saved < 0) return;

    setSaving(true);
    const payload = {
      title: title.trim(),
      plannedAmount: amount,
      plannedDate: plannedDate ? new Date(plannedDate).toISOString() : null,
      category,
      status,
      note: note.trim() || null,
      savedAmount: saved,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      savingsModel,
      percentOfRevenue:
        savingsModel === "PERCENT_REVENUE" ? parseFloat(percentOfRevenue.replace(",", ".")) : null,
      amountPerOrder:
        savingsModel === "FIXED_PER_ORDER" ? parseFloat(amountPerOrder.replace(",", ".")) : null,
      monthlyAmount:
        savingsModel === "FIXED_MONTHLY" ? parseFloat(monthlyAmount.replace(",", ".")) : null,
      calculationBasis,
      machineId: machineId === NONE ? null : machineId,
      articleId: articleId === NONE ? null : articleId,
      projectId: projectId === NONE ? null : projectId,
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
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Investition bearbeiten" : "Geplante Investition"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {FINANCE_DISCLAIMERS.whenToInvest}
          </p>

          <div className="grid gap-2">
            <Label htmlFor="inv-title">Geplante Investition</Label>
            <Input
              id="inv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Ersatz für Fliesenmaschine"
            />
          </div>

          {investment && (
            <div className="rounded-lg border border-slate-100 p-3">
              <div className="mb-2 flex justify-between text-sm">
                <span>Zurückgelegt {formatEuro(investment.savedAmount)}</span>
                <span>Offen {formatEuro(investment.remainingAmount)}</span>
              </div>
              <InvestmentProgress percent={investment.progressPercent} />
              <p className="mt-1 text-xs text-slate-500">{investment.progressPercent} % von {formatEuro(investment.plannedAmount)}</p>
              {investment.hints.map((hint) => (
                <p key={hint} className="mt-2 text-xs text-slate-600">{hint}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="inv-amount">Gewünschter Kaufpreis (€)</Label>
              <Input
                id="inv-amount"
                inputMode="decimal"
                value={plannedAmount}
                onChange={(e) => setPlannedAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-saved">Bereits zurückgelegt (€)</Label>
              <Input
                id="inv-saved"
                inputMode="decimal"
                value={savedAmount}
                onChange={(e) => setSavedAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-date">Zieltermin</Label>
              <Input
                id="inv-date"
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-start">Startdatum</Label>
              <Input
                id="inv-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Wie möchtest du für diese Investition zurücklegen?</Label>
            <Select
              value={savingsModel}
              onValueChange={(value) => setSavingsModel(value as InvestmentSavingsModel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SAVINGS_MODEL_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {savingsModel === "PERCENT_REVENUE" && (
            <div className="grid gap-2">
              <Label htmlFor="inv-percent">Prozent vom Auftragsumsatz</Label>
              <Input
                id="inv-percent"
                inputMode="decimal"
                value={percentOfRevenue}
                onChange={(e) => setPercentOfRevenue(e.target.value)}
                placeholder="z. B. 5"
              />
            </div>
          )}
          {savingsModel === "FIXED_PER_ORDER" && (
            <div className="grid gap-2">
              <Label htmlFor="inv-per-order">Betrag pro abgeschlossenem Auftrag (€)</Label>
              <Input
                id="inv-per-order"
                inputMode="decimal"
                value={amountPerOrder}
                onChange={(e) => setAmountPerOrder(e.target.value)}
                placeholder="z. B. 50"
              />
            </div>
          )}
          {savingsModel === "FIXED_MONTHLY" && (
            <div className="grid gap-2">
              <Label htmlFor="inv-monthly">Fester Betrag pro Monat (€)</Label>
              <Input
                id="inv-monthly"
                inputMode="decimal"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                placeholder="z. B. 500"
              />
            </div>
          )}
          {savingsModel === "TARGET_SCHEDULE" && (
            <p className="text-xs text-slate-500">
              Die App teilt den noch fehlenden Betrag auf die Monate bis zum Zieltermin auf.
            </p>
          )}
          {(savingsModel === "PERCENT_REVENUE" || savingsModel === "FIXED_PER_ORDER") && (
            <div className="grid gap-2">
              <Label>Berechnungsbasis</Label>
              <Select
                value={calculationBasis}
                onValueChange={(value) => setCalculationBasis(value as InvestmentCalculationBasis)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CALCULATION_BASIS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Standard ist der Netto-Auftragsumsatz abgeschlossener Aufträge. Die Basis steht später am Vorschlag.
              </p>
            </div>
          )}

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
              placeholder="optional, z. B. Ersatz wegen Verschleiß"
            />
          </div>

          <div className="grid gap-3">
            <p className="text-xs font-medium text-slate-500">Bezug (optional)</p>
            <div className="grid gap-2">
              <Label>Maschine</Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Keine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Keine</SelectItem>
                  {machineId !== NONE && !machines.some((m) => m.id === machineId) && (
                    <SelectItem value={machineId}>
                      {investment?.machineName ?? "Ausgewählt"}
                    </SelectItem>
                  )}
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Material / Artikel</Label>
              <Select value={articleId} onValueChange={setArticleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kein" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Kein</SelectItem>
                  {articleId !== NONE && !articles.some((a) => a.id === articleId) && (
                    <SelectItem value={articleId}>
                      {investment?.articleName ?? "Ausgewählt"}
                    </SelectItem>
                  )}
                  {articles.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Projekt</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kein" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Kein</SelectItem>
                  {projectId !== NONE && !projects.some((p) => p.id === projectId) && (
                    <SelectItem value={projectId}>
                      {investment?.projectName ?? "Ausgewählt"}
                    </SelectItem>
                  )}
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
