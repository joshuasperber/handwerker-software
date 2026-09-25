"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import { fileToImageBlob } from "@/lib/client/file-to-image-blob";
import { INVOICE_LOGO_API, toAbsoluteLogoSrc } from "@/lib/logo";
import { persistableImageUrl } from "@/lib/stored-image";
import {
  buildCustomerDocumentHtml,
  type DocumentCalcInput,
  type DocumentCompanyInput,
} from "@/lib/documents/build-document-html";
import { Save, Upload, X, Eye, RefreshCw } from "lucide-react";
import { SettingsPageHeader } from "@/components/dashboard/settings-page-header";
import { selectFieldClasses } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_INVOICE_ACCENT,
  INVOICE_FONT_SCALE_LABELS,
  INVOICE_FONT_SCALES,
  INVOICE_LAYOUT_LABELS,
  INVOICE_LAYOUTS,
  INVOICE_TEMPLATE_LABELS,
  INVOICE_TEMPLATES,
  normalizeHexColor,
  type InvoiceFontScale,
  type InvoiceLayout,
  type InvoiceTemplate,
} from "@/lib/documents/invoice-design";

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
  invoiceLegalText: string;
  invoiceAccentColor: string;
  invoiceLayout: InvoiceLayout;
  invoiceFontScale: InvoiceFontScale;
  invoiceTemplate: InvoiceTemplate;
}

type TenantDefaults = Pick<
  InvoiceForm,
  | "companyName"
  | "street"
  | "houseNumber"
  | "postalCode"
  | "city"
  | "phone"
  | "email"
  | "invoiceAccentColor"
> & {
  logoUrl: string;
};

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
  invoiceLegalText: "",
  invoiceAccentColor: DEFAULT_INVOICE_ACCENT,
  invoiceLayout: "LOGO_LEFT",
  invoiceFontScale: "NORMAL",
  invoiceTemplate: "STANDARD",
};

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
  const [tenantDefaults, setTenantDefaults] = useState<TenantDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deferredForm = useDeferredValue(form);

  useEffect(() => {
    fetchJson<{
      company: Partial<InvoiceForm> | null;
      tenantDefaults: TenantDefaults | null;
    }>("/api/company-settings").then((res) => {
      if (res.success && res.data) {
        const source = res.data.company ?? res.data.tenantDefaults;
        setTenantDefaults(res.data.tenantDefaults);
        if (!source) {
          setLoading(false);
          return;
        }
        setForm((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.keys(EMPTY_FORM).map((key) => {
              const value = (source as Record<string, unknown>)[key];
              if (key === "paymentTermsDays") return [key, value != null ? Number(value) : 14];
              if (key === "invoiceAccentColor") return [key, normalizeHexColor(value as string | null)];
              if (key === "invoiceLayout") return [key, value || "LOGO_LEFT"];
              if (key === "invoiceFontScale") return [key, value || "NORMAL"];
              if (key === "invoiceTemplate") return [key, value || "STANDARD"];
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

  function applyTenantDefaults() {
    if (!tenantDefaults) return;
    setForm((current) => ({
      ...current,
      companyName: tenantDefaults.companyName,
      street: tenantDefaults.street,
      houseNumber: tenantDefaults.houseNumber,
      postalCode: tenantDefaults.postalCode,
      city: tenantDefaults.city,
      phone: tenantDefaults.phone,
      email: tenantDefaults.email,
      invoiceAccentColor: normalizeHexColor(tenantDefaults.invoiceAccentColor),
    }));
    toast.success("Betriebsdaten übernommen – bitte noch speichern");
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte eine Bilddatei auswählen");
      return;
    }

    setLogoBusy(true);
    const toastId = toast.loading("Logo wird gespeichert …");
    try {
      const blob = await fileToImageBlob(file);
      const body = new FormData();
      body.append("file", blob, "logo.png");
      const res = await fetchJson<{ invoiceLogoUrl: string | null; hasInvoiceLogo: boolean }>(
        INVOICE_LOGO_API,
        { method: "POST", body }
      );
      if (!res.success || !res.data?.invoiceLogoUrl) {
        toast.error(res.error ?? "Logo konnte nicht gespeichert werden", { id: toastId });
        return;
      }
      update("invoiceLogoUrl", res.data.invoiceLogoUrl);
      toast.success("Logo gespeichert", { id: toastId });
    } catch {
      toast.error("Logo konnte nicht verarbeitet werden", { id: toastId });
    } finally {
      setLogoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    setLogoBusy(true);
    const toastId = toast.loading("Logo wird entfernt …");
    try {
      const res = await fetchJson<{ invoiceLogoUrl: null; hasInvoiceLogo: boolean }>(
        INVOICE_LOGO_API,
        { method: "DELETE" }
      );
      if (!res.success) {
        toast.error(res.error ?? "Logo konnte nicht entfernt werden", { id: toastId });
        return;
      }
      update("invoiceLogoUrl", "");
      toast.success(
        tenantDefaults?.logoUrl ? "Eigenes Rechnungslogo entfernt – Betriebslogo wird verwendet" : "Logo entfernt",
        { id: toastId }
      );
    } finally {
      setLogoBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    const { invoiceLogoUrl, ...rest } = form;
    const persistLogo = persistableImageUrl(invoiceLogoUrl);
    await saveJson(
      "/api/company-settings",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: persistLogo !== undefined ? { ...rest, invoiceLogoUrl: persistLogo } : rest,
        }),
      },
      { loading: "Rechnungseinstellungen werden gespeichert …", success: "Rechnungseinstellungen gespeichert" }
    );
    setSaving(false);
  }

  const previewHtml = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const company: DocumentCompanyInput = {
      companyName: deferredForm.companyName || "Mein Handwerksbetrieb",
      street: deferredForm.street,
      houseNumber: deferredForm.houseNumber,
      postalCode: deferredForm.postalCode,
      city: deferredForm.city,
      phone: deferredForm.phone,
      email: deferredForm.email,
      website: deferredForm.website,
      invoiceLogoUrl: toAbsoluteLogoSrc(
        deferredForm.invoiceLogoUrl || tenantDefaults?.logoUrl,
        origin
      ),
      bankName: deferredForm.bankName,
      iban: deferredForm.iban,
      bic: deferredForm.bic,
      taxNumber: deferredForm.taxNumber,
      vatId: deferredForm.vatId,
      paymentTermsDays: deferredForm.paymentTermsDays,
      invoiceIntroText: deferredForm.invoiceIntroText,
      invoiceFooterText: deferredForm.invoiceFooterText,
      invoiceNotes: deferredForm.invoiceNotes,
      invoiceLegalText: deferredForm.invoiceLegalText,
      invoiceAccentColor: deferredForm.invoiceAccentColor,
      invoiceLayout: deferredForm.invoiceLayout,
      invoiceFontScale: deferredForm.invoiceFontScale,
      invoiceTemplate: deferredForm.invoiceTemplate,
    };
    return buildCustomerDocumentHtml("INVOICE", SAMPLE_CALC, company, "RE-2026-0001");
  }, [deferredForm, tenantDefaults?.logoUrl]);

  const effectiveLogoUrl = form.invoiceLogoUrl || tenantDefaults?.logoUrl || "";

  const logoUrlFieldValue =
    form.invoiceLogoUrl.startsWith("data:") || form.invoiceLogoUrl.startsWith("/api/")
      ? ""
      : form.invoiceLogoUrl;

  if (loading) {
    return <p className="text-sm text-slate-500">Einstellungen werden geladen …</p>;
  }

  return (
    <div>
      <SettingsPageHeader href="/dashboard/einstellungen/rechnung" />
      <p className="mb-6 max-w-3xl text-xs text-slate-500">
        Neue Einstellungen gelten für neue Rechnungen. Bereits erstellte Belege behalten ihren
        gespeicherten Stand. Die Vorschau rechts nutzt Beispieldaten.
      </p>

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
            <Card
              title="Firmendaten"
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!tenantDefaults}
                  onClick={applyTenantDefaults}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Betriebsdaten übernehmen
                </Button>
              }
            >
              <p className="mb-3 text-xs text-slate-500">
                Beim ersten Einrichten werden die Betriebsdaten vorbelegt. Hier können Sie sie für
                Rechnungen unabhängig ändern und speichern.
              </p>
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
                  <p>Das Logo erscheint oben auf Angebot und Rechnung. Empfohlen: PNG mit transparentem Hintergrund. Das Bild wird automatisch verkleinert und sofort gespeichert.</p>
                </InfoButton>
              }
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                  {effectiveLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={effectiveLogoUrl} alt="Logo-Vorschau" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400">Kein Logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={logoBusy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" /> {logoBusy ? "Speichern …" : "Logo hochladen"}
                  </Button>
                  {form.invoiceLogoUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={logoBusy}
                      onClick={removeLogo}
                    >
                      <X className="mr-2 h-4 w-4" /> Entfernen
                    </Button>
                  )}
                </div>
              </div>
              {!form.invoiceLogoUrl && tenantDefaults?.logoUrl && (
                <p className="mt-3 text-xs text-slate-500">
                  Aktuell wird das Logo aus den Betriebseinstellungen verwendet. Ein Upload hier
                  legt nur für Angebote und Rechnungen ein eigenes Logo fest.
                </p>
              )}
              <Input
                label="Alternativ: Logo-URL"
                value={logoUrlFieldValue}
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
                <Textarea label="Rechtliche Hinweise" value={form.invoiceLegalText} onChange={(e) => update("invoiceLegalText", e.target.value)} rows={2} placeholder="z. B. Es gelten unsere AGB. Gerichtsstand …" />
              </div>
            </Card>

            <Card
              title="Design"
              action={
                <InfoButton title="Rechnungsdesign">
                  <p>
                    Farbe, Logo-Position, Schriftgröße und Vorlage gelten für neue Rechnungen. Die
                    Live-Vorschau rechts zeigt die Wirkung sofort.
                  </p>
                </InfoButton>
              }
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="invoice-accent">Akzentfarbe</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <input
                      id="invoice-accent"
                      type="color"
                      value={normalizeHexColor(form.invoiceAccentColor)}
                      onChange={(e) => update("invoiceAccentColor", e.target.value)}
                      className="h-11 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                    />
                    <Input
                      value={form.invoiceAccentColor}
                      onChange={(e) => update("invoiceAccentColor", e.target.value)}
                      placeholder="#0d5c63"
                      className="max-w-[160px]"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="invoice-layout">Anordnung Logo / Titel</Label>
                  <select
                    id="invoice-layout"
                    className={`${selectFieldClasses} mt-1.5`}
                    value={form.invoiceLayout}
                    onChange={(e) => update("invoiceLayout", e.target.value as InvoiceLayout)}
                  >
                    {INVOICE_LAYOUTS.map((layout) => (
                      <option key={layout} value={layout}>
                        {INVOICE_LAYOUT_LABELS[layout]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="invoice-font">Schriftgröße</Label>
                    <select
                      id="invoice-font"
                      className={`${selectFieldClasses} mt-1.5`}
                      value={form.invoiceFontScale}
                      onChange={(e) => update("invoiceFontScale", e.target.value as InvoiceFontScale)}
                    >
                      {INVOICE_FONT_SCALES.map((scale) => (
                        <option key={scale} value={scale}>
                          {INVOICE_FONT_SCALE_LABELS[scale]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="invoice-template">Vorlage</Label>
                    <select
                      id="invoice-template"
                      className={`${selectFieldClasses} mt-1.5`}
                      value={form.invoiceTemplate}
                      onChange={(e) => update("invoiceTemplate", e.target.value as InvoiceTemplate)}
                    >
                      {INVOICE_TEMPLATES.map((tpl) => (
                        <option key={tpl} value={tpl}>
                          {INVOICE_TEMPLATE_LABELS[tpl]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
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
                  className="h-[420px] w-full bg-white sm:h-[600px]"
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
