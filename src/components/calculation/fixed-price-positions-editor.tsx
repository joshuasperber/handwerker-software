"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Line = { description: string; quantity: string; unitPriceNet: string };

export function FixedPricePositionsEditor({ calculationId }: { calculationId: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetch(`/api/calculations/${calculationId}/fixed-price-positions`);
      const data = await res.json();
      if (!active || !data.success || !Array.isArray(data.data)) return;
      setLines(
        data.data.map((line: { description: string; quantity: number; unitPriceNet: number | null }) => ({
          description: line.description,
          quantity: String(line.quantity),
          unitPriceNet: line.unitPriceNet == null ? "" : String(line.unitPriceNet),
        }))
      );
    })();
    return () => {
      active = false;
    };
  }, [calculationId]);

  async function save() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/calculations/${calculationId}/fixed-price-positions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: lines
          .filter((line) => line.description.trim())
          .map((line) => ({
            description: line.description.trim(),
            quantity: Number(line.quantity.replace(",", ".")) || 1,
            unitPriceNet: line.unitPriceNet.trim()
              ? Number(line.unitPriceNet.replace(",", "."))
              : null,
          })),
      }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-4">
      <h3 className="font-medium text-slate-900">Leistungspositionen zum Festpreis</h3>
      <p className="mt-1 text-xs text-slate-500">
        Beschreibungen für Angebot und Rechnung. Der Gesamtbetrag bleibt der Festpreis.
        Einzelpreise sind optional.
      </p>
      <div className="mt-3 space-y-2">
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_5rem_7rem_auto]">
            <Input
              value={line.description}
              placeholder="z. B. Montage"
              aria-label={`Position ${index + 1}`}
              onChange={(e) =>
                setLines((prev) => prev.map((row, i) => (i === index ? { ...row, description: e.target.value } : row)))
              }
            />
            <Input
              inputMode="decimal"
              value={line.quantity}
              aria-label={`Menge ${index + 1}`}
              onChange={(e) =>
                setLines((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: e.target.value } : row)))
              }
            />
            <Input
              inputMode="decimal"
              value={line.unitPriceNet}
              placeholder="ohne Preis"
              aria-label={`Einzelpreis ${index + 1}`}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((row, i) => (i === index ? { ...row, unitPriceNet: e.target.value } : row))
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
            >
              Entfernen
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setLines((prev) => [...prev, { description: "", quantity: "1", unitPriceNet: "" }])}
        >
          Position hinzufügen
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Speichern…" : "Positionen speichern"}
        </Button>
        {saved && <span className="self-center text-xs text-slate-500">Gespeichert</span>}
      </div>
    </div>
  );
}
