"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveJson } from "@/lib/save-toast";
import { useApiSWR } from "@/lib/swr";

type CustomerOpt = { id: string; name: string };
type OrderOpt = { id: string; orderNumber: string; title?: string | null };

const TYPES = [
  { value: "ZUSATZARBEIT", label: "Zusatzarbeit" },
  { value: "NEUE_ANFRAGE", label: "Neue Anfrage" },
  { value: "MATERIAL_FEHLT", label: "Material fehlt" },
  { value: "SCHADEN", label: "Schadenmeldung" },
  { value: "RUECKFRAGE", label: "Kundenrückfrage" },
  { value: "SONSTIGES", label: "Sonstiges" },
] as const;

export default function MonteurAnfragePage() {
  const router = useRouter();
  const { data: customers = [] } = useApiSWR<CustomerOpt[]>("/api/monteur/customers", {
    shouldRetryOnError: false,
  });
  const { data: ordersPayload } = useApiSWR<{ orders: OrderOpt[] } | OrderOpt[]>(
    "/api/monteur/orders?scope=mine",
    { shouldRetryOnError: false }
  );
  const orders: OrderOpt[] = Array.isArray(ordersPayload)
    ? ordersPayload
    : ordersPayload?.orders ?? [];
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "ZUSATZARBEIT",
    urgency: "NORMAL",
    estimatedHours: "",
    materialNotes: "",
    addressNote: "",
    customerId: "",
    orderId: "",
  });

  async function submit(asDraft: boolean) {
    setError("");
    setSaving(true);
    const data = await saveJson(
      "/api/work-requests",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customerId: form.customerId || undefined,
          orderId: form.orderId || undefined,
          estimatedHours: form.estimatedHours || undefined,
          asDraft,
        }),
      },
      { error: "Anfrage konnte nicht gespeichert werden", success: asDraft ? "Entwurf gespeichert" : "Anfrage gesendet" }
    );
    setSaving(false);
    if (data.success) {
      router.push("/monteur/mehr");
    } else {
      setError(data.error ?? "Fehler");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardPlus className="h-6 w-6 text-[#0d5c63]" />
          Neue Anfrage erfassen
        </h1>
        <p className="text-sm text-slate-500">
          Zusatzarbeit, Materialbedarf oder Rückfragen an Büro/Admin melden.
        </p>
      </div>

      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Input
          label="Kurzbeschreibung *"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          placeholder="z. B. Zusatzfenster im Bad"
        />
        <div>
          <label className="text-sm font-medium">Beschreibung *</label>
          <textarea
            className="mt-1 w-full min-h-[100px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            placeholder="Was wurde vor Ort besprochen?"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Art</label>
            <select
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Dringlichkeit</label>
            <select
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={form.urgency}
              onChange={(e) => setForm({ ...form, urgency: e.target.value })}
            >
              <option value="NORMAL">Normal</option>
              <option value="DRINGEND">Dringend</option>
              <option value="NOTFALL">Notfall</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Kunde (aus eigenen Aufträgen)</label>
          <select
            className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
          >
            <option value="">— optional —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Bezug Auftrag</label>
          <select
            className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
          >
            <option value="">— optional —</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber}
                {o.title ? ` – ${o.title}` : ""}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Adresse / Ort"
          value={form.addressNote}
          onChange={(e) => setForm({ ...form, addressNote: e.target.value })}
        />
        <Input
          label="Geschätzter Aufwand (Stunden)"
          inputMode="decimal"
          value={form.estimatedHours}
          onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })}
        />
        <div>
          <label className="text-sm font-medium">Benötigtes Material</label>
          <textarea
            className="mt-1 w-full min-h-[72px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={form.materialNotes}
            onChange={(e) => setForm({ ...form, materialNotes: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button type="submit" variant="action" className="min-h-11" disabled={saving}>
            Zur Prüfung senden
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={saving}
            onClick={() => void submit(true)}
          >
            Als Entwurf speichern
          </Button>
        </div>
      </form>
    </div>
  );
}
