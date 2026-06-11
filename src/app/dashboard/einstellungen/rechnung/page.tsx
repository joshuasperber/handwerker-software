"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { InfoButton } from "@/components/ui/info-button";
import { CanAccess } from "@/components/auth/can-access";
import { saveJson } from "@/lib/save-toast";
import { fetchJson } from "@/lib/fetch-json";
import {
  buildCustomerDocumentHtml,
  type DocumentCalcInput,
  type DocumentCompanyInput,
} from "@/lib/documents/build-document-html";
import { ChevronLeft, Save, Upload, X, Eye } from "lucide-react";

interface InvoiceForm {
  companyName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  taxNumber: string;
  vatId: string;
  bankName: string;
  iban: string;
  bic: string;
  paymentTermsDays: number;
  invoiceLogoUrl: string;
  invoiceIntroText: string;
  invoiceNotes: string;
  invoiceFooterText: string;
}

const EMPTY_FORM: InvoiceForm = {
  companyName: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  phone: "",
  email: "",
  website: "",
  taxNumber: "",
  vatId: "",
  bankName: "",
  iban: "",
  bic: "",
  paymentTermsDays: 14,
  invoiceLogoUrl: "",
  invoiceIntroText: "",
  invoiceNotes: "",
  invoiceFooterText: "",
};

const MAX_LOGO_DIMENSION = 400;

/** Liest ein Bild ein und skaliert es client-seitig zu einer kleinen Data-URL (PNG). */
function fileToLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.onload = () => {
        const scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(img.width, img.height));
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

/** Beispielkalkulation für die Live-Vorschau. */
const SAMPLE_CALC: DocumentCalcInput = {
  title: "Beispielleistung – Badsanierung",
  netSalesPrice: 1000,
  vatAmount: 190,
  grossSalesPrice: 1190,
  laborTotal: 600,
  materialTotal: 300,
  machineTotal: 0,
  procurementTotal: 0,
  travelTotal: 100,
  additionalTotal: 0,
  directCosts: 1000,
  overheadAmount: 0,
  riskAmount: 0,
  profitAmount: 0,
  laborItems: [
    { description: "Arbeitszeit Monteur (8 Std.)", totalNet: 600, isVisibleToCustomer: true },
  ],
  materialItems: [{ name: "Material", totalSalesNet: 300, isVisibleToCustomer: true }],
  travelCost: { totalNet: 100, isVisibleToCustomer: true },
  customer: { firstName: "Max", lastName: "Mustermann" },
  order: {
    orderNumber: "AUF-2026-0001",
    property: { street: "Musterstraße 1", zipCode: "12345", city: "Musterstadt" },
  },
};

export default function RechnungseinstellungenPage() {
  const [form, setForm] = useState<InvoiceForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchJson<{ company: Partial<InvoiceForm> | null }>("/api/company-settings").then((res) => {
      if (res.success && res.data?.company) {
        const c = res.data.company;
        setForm((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.keys(EMPTY_FORM).map((key) => {
              const value = (c as Record<string, unknown>)[key];
              if (key === "paymentTermsDays") return [key, value != null ? Number(value) : 14];
              return [key, value ?? ""];
            })
          ),
        }) as InvoiceForm);
      }
      setLoading(false);
    });
  }, []);

  function update<K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte eine Bilddatei auswählen");
      return;
    }
    try {
      update("invoiceLogoUrl", await fileToLogoDataUrl(file));
      toast.success("Logo geladen – bitte speichern, um es zu übernehmen.");
    } catch {
      toast.error("Logo konnte nicht verarbeitet werden");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    await saveJson(
      "/api/company-settings",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: form }),
      },
      { loading: "Rechnungseinstellungen werden gespeichert …", success: "Rechnungseinstellungen gespeichert" }
    );
    setSaving(false);
  }

  const previewHtml = useMemo(() => {
    const company: DocumentCompanyInput = {
      companyName: form.companyName || "Mein Handwerksbetrieb",
      street: form.street,
      houseNumber: form.houseNumber,
      postalCode: form.postalCode,
      city: form.city,
      phone: form.phone,
      email: form.email,
      website: form.website,
      invoiceLogoUrl: form.invoiceLogoUrl,
      bankName: form.bankName,
      iban: form.iban,
      bic: form.bic,
      taxNumber: form.taxNumber,
      vatId: form.vatId,
      paymentTermsDays: form.paymentTermsDays,
      invoiceIntroText: form.invoiceIntroText,
      invoiceFooterText: form.invoiceFooterText,
      invoiceNotes: form.invoiceNotes,
    };
    return buildCustomerDocumentHtml("INVOICE", SAMPLE_CALC, company, "RE-2026-0001");
  }, [form]);

  if (loading) {
    return <p className="text-sm text-slate-500">Einstellungen werden geladen …</p>;
  }

  return (
    <div>
      <Link
        href="/dashboard/kalkulation/einstellungen"
        className="text-sm text-[#0d5c63] flex items-center gap-1 mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück zu den Einstellungen
      </Link>

      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Rechnungseinstellungen</h1>
        <InfoButton title="Rechnungseinstellungen">
          <p>
            Diese Stammdaten werden automatisch für neue Angebote und Rechnungen verwendet. Bereits
            erstellte Rechnungen behalten ihre Rechnungsnummer und werden hierdurch nicht verändert.
          </p>
          <p>Die Vorschau rechts zeigt mit Beispieldaten, wie Ihre Rechnung aussieht.</p>
        </InfoButton>
      </div>

      <CanAccess
        permission="calculations.settings"
        fallback={
          <Card>
            <p className="text-sm text-slate-600">
              Sie haben keine Berechtigung, die Rechnungseinstellungen zu bearbeiten.
            </p>
          </Card>
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Linke Spalte: Formular */}
          <div className="space-y-6">
            <Card title="Firmendaten">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Firmenname" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} className="sm:col-span-2" />
                <Input label="Straße" value={form.street} onChange={(e) => update("street", e.target.value)} />
                <Input label="Hausnr." value={form.houseNumber} onChange={(e) => update("houseNumber", e.target.value)} />
                <Input label="PLZ" value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} />
                <Input label="Ort" value={form.city} onChange={(e) => update("city", e.target.value)} />
                <Input label="Telefon" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                <Input label="E-Mail" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
                <Input label="Website" value={form.website} onChange={(e) => update("website", e.target.value)} className="sm:col-span-2" placeholder="www.mein-betrieb.de" />
              </div>
            </Card>

            <Card
              title="Logo"
              action={
                <InfoButton title="Firmenlogo">
                  <p>Das Logo erscheint oben auf Angebot und Rechnung. Empfohlen: PNG mit transparentem Hintergrund. Das Bild wird automatisch verkleinert.</p>
                </InfoButton>
              }
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                  {form.invoiceLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.invoiceLogoUrl} alt="Logo-Vorschau" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400">Kein Logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Logo hochladen
                  </Button>
                  {form.invoiceLogoUrl && (
                    <Button type="button" variant="outline" size="sm" onClick={() => update("invoiceLogoUrl", "")}>
                      <X className="mr-2 h-4 w-4" /> Entfernen
                    </Button>
                  )}
                </div>
              </div>
              <Input
                label="Alternativ: Logo-URL"
                value={form.invoiceLogoUrl.startsWith("data:") ? "" : form.invoiceLogoUrl}
                onChange={(e) => update("invoiceLogoUrl", e.target.value)}
                placeholder="https://…/logo.png"
                className="mt-3"
              />
            </Card>

            <Card title="Steuer & Bankverbindung">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Steuernummer" value={form.taxNumber} onChange={(e) => update("taxNumber", e.target.value)} />
                <Input label="USt-IdNr." value={form.vatId} onChange={(e) => update("vatId", e.target.value)} />
                <Input label="Bank" value={form.bankName} onChange={(e) => update("bankName", e.target.value)} className="sm:col-span-2" />
                <Input label="IBAN" value={form.iban} onChange={(e) => update("iban", e.target.value)} />
                <Input label="BIC" value={form.bic} onChange={(e) => update("bic", e.target.value)} />
              </div>
            </Card>

            <Card
              title="Zahlungsbedingungen & Texte"
              action={
                <InfoButton title="Platzhalter in Texten">
                  <p>In Einleitung, Hinweisen und Fußzeile können Sie Platzhalter verwenden, die beim Erzeugen automatisch ersetzt werden:</p>
                  <p className="font-mono text-xs">
                    {"{{kundenname}}"}, {"{{rechnungsnummer}}"}, {"{{auftragsnummer}}"}, {"{{adresse}}"}, {"{{gesamtsumme}}"}, {"{{nettosumme}}"}, {"{{zahlungsziel}}"}, {"{{datum}}"}, {"{{firmenname}}"}
                  </p>
                  <p>Beispiel: „Vielen Dank für Ihren Auftrag {"{{auftragsnummer}}"}. Bitte überweisen Sie {"{{gesamtsumme}}"} bis zum {"{{zahlungsziel}}"}.“</p>
                </InfoButton>
              }
            >
              <NumberInput label="Zahlungsziel (Tage)" allowDecimal={false} min={0} value={form.paymentTermsDays} onValueChange={(v) => update("paymentTermsDays", v ?? 0)} className="sm:max-w-[200px]" />
              <div className="mt-4 space-y-3">
                <Textarea label="Einleitungstext (über den Positionen)" value={form.invoiceIntroText} onChange={(e) => update("invoiceIntroText", e.target.value)} rows={2} placeholder="z. B. Sehr geehrte/r {{kundenname}}, vielen Dank für Ihren Auftrag {{auftragsnummer}}." />
                <Textarea label="Hinweise / Zahlungsbedingungen" value={form.invoiceNotes} onChange={(e) => update("invoiceNotes", e.target.value)} rows={2} placeholder="z. B. Bitte überweisen Sie den Betrag bis zum {{zahlungsziel}} ohne Abzug." />
                <Textarea label="Fußzeile" value={form.invoiceFooterText} onChange={(e) => update("invoiceFooterText", e.target.value)} rows={2} placeholder="z. B. Vielen Dank für Ihr Vertrauen. {{firmenname}}" />
              </div>
            </Card>

            <Button variant="action" onClick={save} disabled={saving} className="w-full sm:w-auto">
              <Save className="h-4 w-4 mr-1" /> {saving ? "Speichern …" : "Speichern"}
            </Button>
          </div>

          {/* Rechte Spalte: Live-Vorschau */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Card
              title="Vorschau (Beispieldaten)"
              action={
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Eye className="h-3.5 w-3.5" /> Live
                </span>
              }
            >
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <iframe
                  title="Rechnungsvorschau"
                  srcDoc={previewHtml}
                  className="h-[600px] w-full bg-white"
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Vorschau mit Beispielkunde und Beispielpositionen. Echte Rechnungen verwenden die
                Daten des jeweiligen Auftrags.
              </p>
            </Card>
          </div>
        </div>
      </CanAccess>
    </div>
  );
}
