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
    setMachineId(NONE);
    setArticleId(NONE);
    setProjectId(NONE);
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
    if (!title.trim() || Number.isNaN(amount) || amount < 0) return;

    setSaving(true);
    const payload = {
      title: title.trim(),
      plannedAmount: amount,
      plannedDate: plannedDate ? new Date(plannedDate).toISOString() : null,
      category,
      status,
      note: note.trim() || null,
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
