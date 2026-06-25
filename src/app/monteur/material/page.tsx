"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { MonteurMaterialView } from "@/components/monteur/material-view";
import { fetchJson } from "@/lib/fetch-json";

export default function MonteurMaterialPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pickupData, setPickupData] = useState<{
    byOrder: Parameters<typeof MonteurMaterialView>[0]["byOrder"];
    aggregated: Parameters<typeof MonteurMaterialView>[0]["aggregated"];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Datenfetch beim Datumswechsel
    setLoading(true);
    setError("");
    fetchJson<{ byOrder: unknown[]; aggregated: unknown[] }>(`/api/monteur/pickup?date=${selectedDate}`)
      .then((d) => {
        if (d.success && d.data) {
          setPickupData({
            byOrder: d.data.byOrder as Parameters<typeof MonteurMaterialView>[0]["byOrder"],
            aggregated: d.data.aggregated as Parameters<typeof MonteurMaterialView>[0]["aggregated"],
          });
        } else {
          setPickupData(null);
          setError(d.error ?? "Material konnte nicht geladen werden");
        }
      })
      .finally(() => setLoading(false));
  }, [selectedDate]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Material</h1>
        <p className="text-sm text-slate-500 mt-1">Packliste für den gewählten Tag</p>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="mt-3 min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm w-full"
        />
      </div>

      {error && !loading && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <MonteurMaterialView
        date={format(new Date(selectedDate), "EEEE, d. MMMM", { locale: de })}
        byOrder={pickupData?.byOrder ?? []}
        aggregated={pickupData?.aggregated ?? []}
        loading={loading}
      />
    </div>
  );
}
