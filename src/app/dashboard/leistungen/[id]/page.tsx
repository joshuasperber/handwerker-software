"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { ChevronLeft, Plus, Trash2, Wrench } from "lucide-react";

interface TemplateLine {
  id: string;
  name: string;
  defaultQuantity: number;
  unit: string;
  isTool: boolean;
  articleId: string | null;
}

interface Article {
  id: string;
  name: string;
  unit: string;
}

export default function LeistungDetailPage() {
  const { id } = useParams();
  const [service, setService] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [templates, setTemplates] = useState<TemplateLine[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [error, setError] = useState("");
  const [materialForm, setMaterialForm] = useState({ articleId: "", defaultQuantity: 1 });
  const [toolForm, setToolForm] = useState({ name: "", defaultQuantity: 1, unit: "Stk" });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch(`/api/services/${id}/material-template`).then((r) => r.json()),
      fetch("/api/articles").then((r) => r.json()),
    ]).then(([s, t, a]) => {
      if (s.success) setService(s.data.find((x: { id: string }) => x.id === id) ?? null);
      if (t.success) setTemplates(t.data);
      if (a.success) setArticles(a.data);
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!materialForm.articleId) {
      setError("Bitte einen Artikel aus dem Inventar wählen.");
      return;
    }
    const article = articles.find((a) => a.id === materialForm.articleId);
    const res = await fetch(`/api/services/${id}/material-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleId: materialForm.articleId,
        defaultQuantity: materialForm.defaultQuantity,
        unit: article?.unit ?? "Stk",
        isTool: false,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setMaterialForm({ articleId: "", defaultQuantity: 1 });
      load();
    } else setError(data.error);
  }

  async function addTool(e: React.FormEvent) {
    e.preventDefault();
    if (!toolForm.name) return;
    await fetch(`/api/services/${id}/material-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...toolForm, isTool: true }),
    });
    setToolForm({ name: "", defaultQuantity: 1, unit: "Stk" });
    load();
  }

  async function deleteLine(templateId: string) {
    await fetch(`/api/services/${id}/material-template/${templateId}`, { method: "DELETE" });
    load();
  }

  if (!service) return <p className="text-slate-500">Laden...</p>;

  const materialLines = templates.filter((t) => !t.isTool);
  const toolLines = templates.filter((t) => t.isTool);

  return (
    <div>
      <Link href="/dashboard/leistungen" className="flex items-center gap-1 text-sm text-[#0d5c63] mb-4 hover:underline">
        <ChevronLeft className="h-4 w-4" /> Zurück zu Leistungen
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">{service.name}</h1>
      {service.description && <p className="text-slate-500 mb-6">{service.description}</p>}

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <Card title="Material-Stückliste (nur Inventar-Artikel)">
        <p className="text-sm text-slate-500 mb-4">
          Materialpositionen müssen aus dem Inventar stammen. Werkzeuge werden separat als nicht-reservierbare Positionen geführt.
        </p>
        <div className="divide-y divide-slate-50 mb-6">
          {materialLines.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-slate-500">{t.defaultQuantity} {t.unit}</p>
              </div>
              <button type="button" onClick={() => deleteLine(t.id)} className="text-red-500 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!materialLines.length && (
            <p className="text-sm text-slate-500 py-4 text-center">Noch kein Material hinterlegt.</p>
          )}
        </div>

        <form onSubmit={addMaterial} className="border-t border-slate-100 pt-4 space-y-3">
          <p className="font-medium text-sm">Material aus Inventar hinzufügen</p>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={materialForm.articleId}
            onChange={(e) => setMaterialForm({ ...materialForm, articleId: e.target.value })}
            required
          >
            <option value="">— Artikel aus Inventar wählen —</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.unit})</option>
            ))}
          </select>
          {articles.length === 0 && (
            <p className="text-xs text-amber-700">
              Keine Artikel im Inventar. Bitte zuerst unter <Link href="/dashboard/inventar" className="underline">Inventar</Link> anlegen.
            </p>
          )}
          <NumberInput label="Menge" min={0} value={materialForm.defaultQuantity}
            onValueChange={(v) => setMaterialForm({ ...materialForm, defaultQuantity: v ?? 0 })} />
          <Button type="submit" size="sm"><Plus className="h-4 w-4 mr-1" /> Material hinzufügen</Button>
        </form>
      </Card>

      <Card title="Werkzeuge (nicht reservierbar)" className="mt-6">
        <div className="divide-y divide-slate-50 mb-4">
          {toolLines.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-slate-400" />
                <span>{t.name} · {t.defaultQuantity} {t.unit}</span>
              </div>
              <button type="button" onClick={() => deleteLine(t.id)} className="text-red-500 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={addTool} className="flex flex-wrap gap-2 items-end">
          <Input label="Werkzeug" value={toolForm.name} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} />
          <NumberInput label="Anzahl" min={1} value={toolForm.defaultQuantity} onValueChange={(v) => setToolForm({ ...toolForm, defaultQuantity: v ?? 1 })} />
          <Button type="submit" size="sm" variant="outline">Werkzeug hinzufügen</Button>
        </form>
      </Card>
    </div>
  );
}
