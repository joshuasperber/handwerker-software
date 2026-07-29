"use client";

import { useCallback, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CanAccess } from "@/components/auth/can-access";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { saveJson } from "@/lib/save-toast";
import { swrKeys, useApiSWR } from "@/lib/swr";
import { formatEuro, formatDate } from "@/lib/utils";
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseDTO,
} from "@/lib/finance/types";
import { ArrowLeft, Loader2, Plus, Receipt, Trash2 } from "lucide-react";

const ALL_CATEGORIES = "__all__";

export function ExpensesPanel({
  onBack,
  onChanged,
}: {
  onBack?: () => void;
  onChanged?: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseDTO | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<ExpenseDTO | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (category && category !== ALL_CATEGORIES) params.set("category", category);
    return params.toString();
  }, [from, to, category]);

  const {
    data: expenses,
    error: swrError,
    isLoading,
    isValidating,
    mutate,
  } = useApiSWR<ExpenseDTO[]>(swrKeys.financeExpenses(queryString), {
    dedupingInterval: 3_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const loading = isLoading && !expenses;
  const error = swrError
    ? swrError instanceof Error
      ? swrError.message
      : "Daten konnten nicht geladen werden"
    : null;

  const refresh = useCallback(async () => {
    await mutate();
    onChanged?.();
  }, [mutate, onChanged]);

  const openCreate = () => {
    setEditingExpense(null);
    setExpenseOpen(true);
  };

  const openEdit = (e: ExpenseDTO) => {
    setEditingExpense(e);
    setExpenseOpen(true);
  };

  const handleWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      const res = await saveJson(
        `/api/finance/expenses/${withdrawTarget.id}`,
        { method: "DELETE" },
        {
          loading: "Ausgabe wird zurückgezogen …",
          success: "Ausgabe zurückgezogen",
          error: "Zurückziehen fehlgeschlagen",
        }
      );
      if (res.success) {
        setWithdrawTarget(null);
        await refresh();
      }
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {onBack && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2 gap-1.5 text-slate-600"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück zur Finanzübersicht
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Receipt className="h-7 w-7 text-[#0d5c63]" />
            <h1 className="text-2xl font-bold text-slate-900">Ausgaben</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Alle Ausgaben und Belege
            {isValidating && expenses && (
              <span className="ml-2 inline-flex items-center gap-1 text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                aktualisiert…
              </span>
            )}
          </p>
        </div>
        <CanAccess permission="invoices.write">
          <Button onClick={openCreate} className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            Ausgaben erfassen
          </Button>
        </CanAccess>
      </div>

      <Card className="!p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="exp-from">Von</Label>
            <Input
              id="exp-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exp-to">Bis</Label>
            <Input
              id="exp-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
            <Label>Kategorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>Alle Kategorien</SelectItem>
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Ausgaben werden geladen…
        </div>
      )}

      {error && !loading && !expenses && (
        <Card className="border-rose-200 bg-rose-50 !p-4 text-rose-800">{error}</Card>
      )}

      {expenses && (
        <Card className="overflow-x-auto !p-0">
          {expenses.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              Keine Ausgaben im gewählten Zeitraum.{" "}
              <CanAccess permission="invoices.write">
                <button
                  type="button"
                  className="text-[#0d5c63] underline"
                  onClick={openCreate}
                >
                  Erste Ausgabe erfassen
                </button>
              </CanAccess>
            </p>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                      <th className="px-4 py-2 font-medium">Datum</th>
                      <th className="px-4 py-2 font-medium">Kategorie</th>
                      <th className="px-4 py-2 font-medium">Beschreibung</th>
                      <th className="px-4 py-2 font-medium text-right">Netto</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Beleg</th>
                      <th className="px-4 py-2 font-medium text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer"
                        onClick={() => openEdit(e)}
                      >
                        <td className="px-4 py-2 whitespace-nowrap">
                          {formatDate(e.expenseDate)}
                        </td>
                        <td className="px-4 py-2">
                          {e.categoryLabel || EXPENSE_CATEGORY_LABELS[e.category]}
                        </td>
                        <td className="px-4 py-2 max-w-[220px] truncate">
                          {e.description}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatEuro(e.netAmount)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge
                            variant="outline"
                            className={
                              e.paymentStatus === "BEZAHLT"
                                ? "border-emerald-300 text-emerald-800"
                                : "border-amber-300 text-amber-800"
                            }
                          >
                            {e.paymentStatusLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">
                          {e.hasReceipt ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                              Vorhanden
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-300 text-amber-800"
                            >
                              Fehlt
                            </Badge>
                          )}
                          {e.isInvestment && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              Investition
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <CanAccess permission="invoices.write">
                            <div
                              className="inline-flex gap-1"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(e)}
                              >
                                Bearbeiten
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                                onClick={() => setWithdrawTarget(e)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Zurückziehen
                              </Button>
                            </div>
                          </CanAccess>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-slate-50">
                {expenses.map((e) => (
                  <div key={e.id} className="p-4 space-y-2">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => openEdit(e)}
                    >
                      <div className="flex justify-between gap-2">
                        <p className="font-medium text-sm">{e.description}</p>
                        <p className="text-sm font-semibold shrink-0">
                          {formatEuro(e.netAmount)}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(e.expenseDate)} ·{" "}
                        {e.categoryLabel || EXPENSE_CATEGORY_LABELS[e.category]}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge
                          variant="outline"
                          className={
                            e.paymentStatus === "BEZAHLT"
                              ? "border-emerald-300 text-emerald-800"
                              : "border-amber-300 text-amber-800"
                          }
                        >
                          {e.paymentStatusLabel}
                        </Badge>
                        {e.hasReceipt ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Beleg
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-300 text-amber-800"
                          >
                            Ohne Beleg
                          </Badge>
                        )}
                      </div>
                    </button>
                    <CanAccess permission="invoices.write">
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openEdit(e)}
                        >
                          Bearbeiten
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => setWithdrawTarget(e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Zurückziehen
                        </Button>
                      </div>
                    </CanAccess>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={(open) => {
          setExpenseOpen(open);
          if (!open) setEditingExpense(null);
        }}
        onSaved={refresh}
        expense={editingExpense}
      />

      <ConfirmDialog
        open={Boolean(withdrawTarget)}
        onOpenChange={(open) => {
          if (!open) setWithdrawTarget(null);
        }}
        title="Ausgabe zurückziehen?"
        description={
          withdrawTarget
            ? `„${withdrawTarget.description}" wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.`
            : undefined
        }
        confirmLabel="Zurückziehen"
        variant="destructive"
        loading={withdrawing}
        onConfirm={handleWithdraw}
      />
    </div>
  );
}
