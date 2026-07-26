"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CanAccess } from "@/components/auth/can-access";
import { saveJson } from "@/lib/save-toast";
import { swrKeys, useApiSWR } from "@/lib/swr";
import { ChevronLeft, Copy, Save, Upload, X } from "lucide-react";

type TenantSettings = {
  slug: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  logoUrl: string | null;
  primaryColor: string;
  privacyPolicyUrl: string | null;
  imprintUrl: string | null;
  bufferMinutes: number;
  bookingUrl: string;
};

const MAX_LOGO_DIMENSION = 400;

function fileToLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.onload = () => {
        const scale = Math.min(
          1,
          MAX_LOGO_DIMENSION / Math.max(img.width, img.height)
        );
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas nicht verfügbar"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function BetriebEinstellungenPage() {
  const { data, mutate, isLoading } = useApiSWR<TenantSettings>(
    swrKeys.tenantSettings()
  );
  const [form, setForm] = useState<Partial<TenantSettings>>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (data && !hydrated.current) {
      setForm(data);
      hydrated.current = true;
    }
  }, [data]);

  function setField<K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveJson(
      "/api/tenant/settings",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
          zipCode: form.zipCode,
          logoUrl: form.logoUrl,
          primaryColor: form.primaryColor,
          privacyPolicyUrl: form.privacyPolicyUrl,
          imprintUrl: form.imprintUrl,
          bufferMinutes: form.bufferMinutes,
        }),
      },
      {
        loading: "Betriebseinstellungen werden gespeichert …",
        success: "Betriebseinstellungen gespeichert",
      }
    );
    setSaving(false);
    if (res.success) {
      hydrated.current = false;
      await mutate();
    }
  }

  async function onLogo(file: File | null) {
    if (!file) return;
    try {
      const url = await fileToLogoDataUrl(file);
      setField("logoUrl", url);
      toast.success("Logo geladen — bitte speichern");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo fehlgeschlagen");
    }
  }

  async function copyBooking() {
    const url = form.bookingUrl || data?.bookingUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Buchungslink kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  }

  if (isLoading && !data) {
    return <p className="text-sm text-slate-500">Laden…</p>;
  }

  return (
    <CanAccess permission="tenant.manage">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Betrieb</h1>
            <p className="text-sm text-muted-foreground">
              Logo, Adresse, Impressum und Buchungslink — zentral für App und
              öffentliche Seiten
            </p>
          </div>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <Card title="Stammdaten" className="space-y-3 !p-4">
            <Input
              label="Betriebsname *"
              value={form.name ?? ""}
              onChange={(e) => setField("name", e.target.value)}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="E-Mail *"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setField("email", e.target.value)}
                required
              />
              <Input
                label="Telefon"
                value={form.phone ?? ""}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </div>
            <Input
              label="Straße / Adresse"
              value={form.address ?? ""}
              onChange={(e) => setField("address", e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="PLZ"
                value={form.zipCode ?? ""}
                onChange={(e) => setField("zipCode", e.target.value)}
              />
              <Input
                label="Ort"
                value={form.city ?? ""}
                onChange={(e) => setField("city", e.target.value)}
              />
            </div>
            <Input
              label="Primärfarbe"
              type="color"
              value={form.primaryColor ?? "#0d5c63"}
              onChange={(e) => setField("primaryColor", e.target.value)}
            />
          </Card>

          <Card title="Logo" className="space-y-3 !p-4">
            <div className="flex flex-wrap items-center gap-4">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logoUrl}
                  alt="Logo"
                  className="h-16 w-16 rounded-xl border border-slate-200 object-contain bg-white p-1"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">
                  Kein Logo
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Hochladen
                </Button>
                {form.logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setField("logoUrl", null)}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Entfernen
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onLogo(e.target.files?.[0] ?? null)}
              />
            </div>
          </Card>

          <Card title="Rechtliches & Buchung" className="space-y-3 !p-4">
            <Input
              label="Datenschutz-URL"
              value={form.privacyPolicyUrl ?? ""}
              onChange={(e) => setField("privacyPolicyUrl", e.target.value)}
              placeholder="https://…"
            />
            <Input
              label="Impressum-URL"
              value={form.imprintUrl ?? ""}
              onChange={(e) => setField("imprintUrl", e.target.value)}
              placeholder="https://…"
            />
            <div>
              <label className="text-sm font-medium text-slate-800">
                Buchungslink
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  className="h-10 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"
                  value={form.bookingUrl || data?.bookingUrl || ""}
                />
                <Button type="button" variant="outline" onClick={copyBooking}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Slug: <code className="rounded bg-slate-100 px-1">{data?.slug}</code>
              </p>
            </div>
          </Card>

          <Button type="submit" variant="action" disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </form>
      </div>
    </CanAccess>
  );
}
