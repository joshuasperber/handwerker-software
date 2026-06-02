"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Marker {
  id: string;
  markerType: string;
  label: string | null;
  posX: number;
  posY: number;
}

interface PlanViewerProps {
  orderId: string;
  fileId: string;
  imageUrl: string | null;
  markers: Marker[];
  onMarkerAdded: () => void;
}

export function PlanViewer({ orderId, fileId, imageUrl, markers, onMarkerAdded }: PlanViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");

  async function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!adding || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const posX = ((e.clientX - rect.left) / rect.width) * 100;
    const posY = ((e.clientY - rect.top) / rect.height) * 100;

    await fetch(`/api/orders/${orderId}/plans/${fileId}/markers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posX, posY, label: label || "Markierung", markerType: "SONSTIGES" }),
    });
    setAdding(false);
    setLabel("");
    onMarkerAdded();
  }

  if (!imageUrl) {
    return <p className="text-sm text-slate-500">Plan-Vorschau nicht verfügbar (S3 nicht konfiguriert).</p>;
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <Button size="sm" variant={adding ? "action" : "outline"} onClick={() => setAdding(!adding)}>
          {adding ? "Klicken Sie auf den Plan…" : "Markierung setzen"}
        </Button>
        {adding && (
          <input
            className="flex-1 rounded border border-slate-200 px-2 text-sm"
            placeholder="Bezeichnung (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        )}
      </div>
      <div
        ref={containerRef}
        className={`relative border rounded-lg overflow-hidden ${adding ? "cursor-crosshair ring-2 ring-[#0d5c63]" : ""}`}
        onClick={handleClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Plan" className="w-full h-auto block" />
        {markers.map((m) => (
          <div
            key={m.id}
            className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-[#e87722] border-2 border-white shadow"
            style={{ left: `${m.posX}%`, top: `${m.posY}%` }}
            title={m.label ?? m.markerType}
          />
        ))}
      </div>
      {markers.length > 0 && (
        <ul className="mt-3 text-sm text-slate-600 space-y-1">
          {markers.map((m) => (
            <li key={m.id}>• {m.label ?? m.markerType} ({Math.round(m.posX)}%, {Math.round(m.posY)}%)</li>
          ))}
        </ul>
      )}
    </div>
  );
}
