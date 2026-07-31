"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { saveJson } from "@/lib/save-toast";
import { Calculator, Euro } from "lucide-react";

type Mode = "detail" | "fixed";
type AmountMode = "net" | "gross";

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  customerType?: "PRIVAT" | "GEWERBLICH";
}

export function CreateCalculationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("detail");
  const [amountMode, setAmountMode] = useState<AmountMode>("net");
  const [fixedPrice, setFixedPrice] = useState<number | null>(null);
  const [fixedLabel, setFixedLabel] = useState("Festpreis");
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchJson<CustomerOption[]>("/api/customers").then((res) => {
      if (res.success && res.data) setCustomers(res.data);
    });
  }, [open]);

  async function create() {
    setBusy(true);
    try {
      if (mode === "fixed") {
        if (fixedPrice == null || !Number.isFinite(fixedPrice) || fixedPrice < 0) {
          setBusy(false);
          return;
        }
        const data = await saveJson<{ id: string; openStep?: number }>(
          "/api/calculations",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              useFixedPrice: true,
              fixedPriceNet: fixedPrice,
              fixedPriceLabel: fixedLabel.trim() || "Festpreis",
              amountMode,
              customerId: customerId || undefined,
            }),
          },
          {
            loading: "Festpreis-Kalkulation wird angelegt …",
            success: "Festpreis-Kalkulation angelegt",
          }
        );
        if (data.success && data.data) {
          onOpenChange(false);
          window.location.href = `/dashboard/kalkulation/${data.data.id}?step=${data.data.openStep ?? 10}`;
        }
      } else {
        const data = await saveJson<{ id: string }>(
          "/api/calculations",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Neue Kalkulation",
              customerId: customerId || undefined,
            }),
          },
          {
            loading: "Kalkulation wird angelegt …",
            success: "Kalkulation angelegt",
          }
        );
        if (data.success && data.data) {
          onOpenChange(false);
          window.location.href = `/dashboard/kalkulation/${data.data.id}`;
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neue Kalkulation</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("detail")}
            className={cn(
              "flex flex-col items-start gap-1 rounded-2xl border px-3 py-3 text-left transition-colors",
              mode === "detail"
                ? "border-[#0d5c63] bg-[#0d5c63]/5 ring-2 ring-[#0d5c63]/20"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Calculator className="h-4 w-4" /> Detailkalkulation
            </span>
            <span className="text-xs text-slate-500">
              Arbeit, Material, Zuschläge Schritt für Schritt
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("fixed")}
            className={cn(
              "flex flex-col items-start gap-1 rounded-2xl border px-3 py-3 text-left transition-colors",
              mode === "fixed"
                ? "border-[#0d5c63] bg-[#0d5c63]/5 ring-2 ring-[#0d5c63]/20"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Euro className="h-4 w-4" /> Festpreis
            </span>
            <span className="text-xs text-slate-500">
              Sofort z. B. 2.000 € — eine Position auf der Rechnung
            </span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Kunde (optional)</Label>
            <select
              className="mt-1 h-11 w-full rounded-2xl border border-slate-300 bg-white px-3.5 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Später wählen</option>
              {customers.map((c) => {
                const label =
                  c.customerType === "GEWERBLICH" && c.company?.trim()
                    ? `${c.company} (${c.firstName} ${c.lastName})`
                    : `${c.firstName} ${c.lastName}${c.company ? ` · ${c.company}` : ""}`;
                return (
                  <option key={c.id} value={c.id}>
                    {c.customerType === "GEWERBLICH" ? "🏢 " : ""}
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {mode === "fixed" && (
            <>
              <NumberInput
                label={`Festpreis (${amountMode === "gross" ? "brutto" : "netto"}) *`}
                suffix="€"
                min={0}
                value={fixedPrice}
                onValueChange={setFixedPrice}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    "h-9 flex-1 rounded-xl border text-sm",
                    amountMode === "net"
                      ? "border-[#0d5c63] bg-[#0d5c63]/10 text-[#0d5c63]"
                      : "border-slate-200"
                  )}
                  onClick={() => setAmountMode("net")}
                >
                  Netto
                </button>
                <button
                  type="button"
                  className={cn(
                    "h-9 flex-1 rounded-xl border text-sm",
                    amountMode === "gross"
                      ? "border-[#0d5c63] bg-[#0d5c63]/10 text-[#0d5c63]"
                      : "border-slate-200"
                  )}
                  onClick={() => setAmountMode("gross")}
                >
                  Brutto
                </button>
              </div>
              <Input
                label="Bezeichnung auf der Rechnung"
                value={fixedLabel}
                onChange={(e) => setFixedLabel(e.target.value)}
                placeholder="Festpreis"
              />
              <p className="text-xs text-slate-500">
                Auf Angebot/Rechnung erscheint eine Position wie „Festpreis – 2.000,00 €“.
                Arbeit, Material usw. müssen Sie nicht ausfüllen.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="action"
            disabled={
              busy ||
              (mode === "fixed" &&
                (fixedPrice == null || !Number.isFinite(fixedPrice) || fixedPrice < 0))
            }
            onClick={() => void create()}
          >
            {mode === "fixed" ? "Festpreis anlegen" : "Kalkulation starten"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
