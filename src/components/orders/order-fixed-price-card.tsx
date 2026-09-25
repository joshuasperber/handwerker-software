"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FixedPriceEditor } from "@/components/calculation/fixed-price-editor";
import type { FixedPriceDisplayMode } from "@/lib/calculation/fixed-price";
import { suggestFixedPriceLabel } from "@/lib/calculation/fixed-price";
import { Save } from "lucide-react";
import { toast } from "sonner";

export interface OrderFixedPriceCardProps {
  orderId: string;
  orderTitle?: string | null;
  initial: {
    useFixedPrice: boolean;
    fixedPriceNet: number | null;
    fixedPriceLabel: string | null;
    fixedPriceDisplayMode?: FixedPriceDisplayMode | string | null;
  };
  calculatedNet?: number;
  onSaved?: () => void;
}

export function OrderFixedPriceCard({
  orderId,
  orderTitle,
  initial,
  calculatedNet = 0,
  onSaved,
}: OrderFixedPriceCardProps) {
  const [useFixedPrice, setUseFixedPrice] = useState(Boolean(initial.useFixedPrice));
  const [fixedPriceNet, setFixedPriceNet] = useState<number | null>(initial.fixedPriceNet);
  const [fixedPriceLabel, setFixedPriceLabel] = useState<string | null>(
    initial.fixedPriceLabel
  );
  const [fixedPriceDisplayMode, setFixedPriceDisplayMode] = useState<FixedPriceDisplayMode>(
    initial.fixedPriceDisplayMode === "POSITIONS_WITH_PRICES" ||
      initial.fixedPriceDisplayMode === "DESCRIPTION_ONLY"
      ? initial.fixedPriceDisplayMode
      : "SINGLE_LINE"
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Aktualisierte Serverwerte initialisieren den editierbaren Kartenentwurf.
    setUseFixedPrice(Boolean(initial.useFixedPrice));
    setFixedPriceNet(initial.fixedPriceNet);
    setFixedPriceLabel(initial.fixedPriceLabel);
    setFixedPriceDisplayMode(
      initial.fixedPriceDisplayMode === "POSITIONS_WITH_PRICES" ||
        initial.fixedPriceDisplayMode === "DESCRIPTION_ONLY"
        ? initial.fixedPriceDisplayMode
        : "SINGLE_LINE"
    );
  }, [initial]);

  async function save() {
    if (
      useFixedPrice &&
      (fixedPriceNet == null || !Number.isFinite(Number(fixedPriceNet)) || Number(fixedPriceNet) < 0)
    ) {
      toast.error("Bitte einen gültigen Festpreis angeben (0,00 € ist erlaubt).");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        useFixedPrice,
        fixedPriceNet: useFixedPrice ? Number(fixedPriceNet) : fixedPriceNet,
        fixedPriceLabel: useFixedPrice
          ? fixedPriceLabel?.trim() || suggestFixedPriceLabel(orderTitle)
          : fixedPriceLabel,
        fixedPriceDisplayMode,
        ensureCalculation: useFixedPrice,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) {
      toast.error(data.error ?? "Festpreis konnte nicht gespeichert werden");
      return;
    }
    toast.success(
      useFixedPrice
        ? "Festpreis gespeichert – gilt für Angebot und Rechnung"
        : "Festpreis deaktiviert"
    );
    onSaved?.();
  }

  return (
    <Card title="Festpreis / Pauschale" className="mb-6">
      <p className="text-sm text-slate-600 mb-2">
        Legen Sie den Festpreis direkt am Auftrag fest. Interne Positionen (Material, Arbeit, Fahrt
        usw.) bleiben erhalten und können in der Kalkulation weiter bearbeitet werden.
      </p>
      <FixedPriceEditor
        useFixedPrice={useFixedPrice}
        fixedPriceNet={fixedPriceNet}
        fixedPriceLabel={fixedPriceLabel}
        fixedPriceDisplayMode={fixedPriceDisplayMode}
        calculatedNet={calculatedNet}
        profitAmount={0}
        directCosts={0}
        onChange={(next) => {
          setUseFixedPrice(next.useFixedPrice);
          setFixedPriceNet(next.fixedPriceNet);
          setFixedPriceLabel(next.fixedPriceLabel);
          setFixedPriceDisplayMode(next.fixedPriceDisplayMode);
        }}
      />
      <Button className="mt-4" variant="action" onClick={save} disabled={saving}>
        <Save className="h-4 w-4 mr-1" />
        {saving ? "Speichere…" : "Festpreis speichern"}
      </Button>
    </Card>
  );
}
