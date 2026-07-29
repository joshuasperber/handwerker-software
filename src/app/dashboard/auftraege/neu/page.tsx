"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Check, Plus, Trash2 } from "lucide-react";
import {
  formatBillingAddressOneLine,
  hasBillingAddress,
  propertyMatchesBilling,
} from "@/lib/addresses/billing-vs-site";
import {
  OrderMaterialEditor,
  type EditableMaterialLine,
  type InventoryArticleOption,
} from "@/components/orders/order-material-editor";
import { OrderTypeSelect } from "@/components/orders/order-type-select";
import { ProjectAssignField } from "@/components/orders/project-assign-field";
import { EmployeeMultiSelect } from "@/components/orders/employee-multi-select";
import { articlePriceForCalculation } from "@/lib/inventory/units";

interface CustomService {
  name: string;
  description: string;
  quantity: number;
  price: number | null;
  notes: string;
}

const STEPS = ["Typ", "Kunde", "Leistung", "Material", "Termin", "Freigabe"];

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  company?: string | null;
  billingStreet?: string | null;
  billingZipCode?: string | null;
  billingCity?: string | null;
  properties: {
    id: string;
    label: string;
    street: string;
    city: string;
    zipCode: string;
    isActive: boolean;
    isPrimary: boolean;
    travelZone: { id: string; name: string } | null;
  }[];
}

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
}

interface Employee {
  id: string;
  user: { firstName: string; lastName: string };
}

interface TravelZone {
  id: string;
  name: string;
}

export default function NeuerAuftragPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [travelZones, setTravelZones] = useState<TravelZone[]>([]);
  const [articles, setArticles] = useState<InventoryArticleOption[]>([]);
  const [materialLines, setMaterialLines] = useState<EditableMaterialLine[]>([]);
  const [materialTouched, setMaterialTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [siteMode, setSiteMode] = useState<"existing" | "new" | "billing">("existing");
  const [creatingProperty, setCreatingProperty] = useState(false);

  const [form, setForm] = useState({
    orderTypeId: "",
    orderTypeCustom: "",
    orderTypeIsOther: false,
    orderTypeName: "",
    title: "",
    description: "",
    customerId: "",
    propertyId: "",
    projectId: "",
    serviceIds: [] as string[],
    customServices: [] as CustomService[],
    employeeIds: [] as string[],
    scheduledStart: "",
    scheduledEnd: "",
    confirmMaterial: false,
    createNewCustomer: false,
    sameSiteAsBilling: true,
    newCustomer: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      billingStreet: "",
      billingZipCode: "",
      billingCity: "",
      siteLabel: "Baustelle",
      siteStreet: "",
      siteZipCode: "",
      siteCity: "",
      siteTravelZoneId: "",
    },
    newSite: {
      label: "Baustelle",
      street: "",
      zipCode: "",
      city: "",
      travelZoneId: "",
    },
  });

  function reloadCustomers() {
    return fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCustomers(d.data);
        return d;
      });
  }

  useEffect(() => {
    reloadCustomers();
    fetch("/api/services").then((r) => r.json()).then((d) => { if (d.success) setServices(d.data); });
    fetch("/api/employees").then((r) => r.json()).then((d) => { if (d.success) setEmployees(d.data); });
    fetch("/api/travel-zones").then((r) => r.json()).then((d) => { if (d.success) setTravelZones(d.data); });
    fetch("/api/articles")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setArticles(d.data);
      })
      .catch(() => {});
  }, []);

  async function loadMaterialSuggestions(force = false) {
    if (materialTouched && !force) return;
    const lines: EditableMaterialLine[] = [];
    for (const sid of form.serviceIds) {
      const matRes = await fetch(`/api/services/${sid}/material-template`);
      const mat = await matRes.json();
      if (!mat.success) continue;
      for (const m of mat.data as {
        name: string;
        defaultQuantity: number;
        unit: string;
        isTool?: boolean;
        articleId?: string | null;
      }[]) {
        if (m.isTool) continue;
        const article = m.articleId
          ? articles.find((a) => a.id === m.articleId)
          : undefined;
        lines.push({
          key: `tmpl-${sid}-${m.name}-${lines.length}`,
          articleId: m.articleId ?? null,
          sourceServiceId: sid,
          name: m.name,
          quantityRequired: m.defaultQuantity,
          unit: m.unit || "Stück",
          unitPriceNet: article ? articlePriceForCalculation(article) : null,
          notes: "",
          stockAvailable: article?.totals?.available ?? null,
        });
      }
    }
    setMaterialLines(lines);
    if (force) setMaterialTouched(false);
  }

  useEffect(() => {
    if (step === 3) {
      void loadMaterialSuggestions(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.serviceIds, articles]);

  async function ensureCustomer(): Promise<{ customerId: string; propertyId: string } | null> {
    if (form.createNewCustomer) {
      const nc = form.newCustomer;
      if (!nc.firstName || !nc.lastName || !nc.billingStreet || !nc.billingZipCode || !nc.billingCity) {
        setError("Bitte Name und Rechnungsadresse für den neuen Kunden ausfüllen.");
        return null;
      }
      const siteStreet = form.sameSiteAsBilling ? nc.billingStreet : nc.siteStreet;
      const siteZip = form.sameSiteAsBilling ? nc.billingZipCode : nc.siteZipCode;
      const siteCity = form.sameSiteAsBilling ? nc.billingCity : nc.siteCity;
      if (!siteStreet || !siteZip || !siteCity) {
        setError("Bitte die Ausführungsadresse / Baustelle ausfüllen.");
        return null;
      }
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: nc.firstName,
          lastName: nc.lastName,
          email: nc.email || undefined,
          phone: nc.phone,
          billingStreet: nc.billingStreet,
          billingZipCode: nc.billingZipCode,
          billingCity: nc.billingCity,
          property: {
            street: siteStreet,
            zipCode: siteZip,
            city: siteCity,
            label: form.sameSiteAsBilling ? "Ausführungsadresse" : nc.siteLabel || "Baustelle",
            travelZoneId: nc.siteTravelZoneId || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Kunde konnte nicht angelegt werden");
        return null;
      }
      return { customerId: data.data.id, propertyId: data.data.properties[0].id };
    }

    if (!form.customerId) {
      setError("Bitte einen Kunden wählen.");
      return null;
    }

    if (siteMode === "existing") {
      if (!form.propertyId) {
        setError("Bitte eine Ausführungsadresse wählen.");
        return null;
      }
      return { customerId: form.customerId, propertyId: form.propertyId };
    }

    const selected = customers.find((c) => c.id === form.customerId);
    if (!selected) {
      setError("Kunde nicht gefunden.");
      return null;
    }

    let street = form.newSite.street;
    let zipCode = form.newSite.zipCode;
    let city = form.newSite.city;
    let label = form.newSite.label || "Baustelle";
    const travelZoneId = form.newSite.travelZoneId || undefined;

    if (siteMode === "billing") {
      if (!hasBillingAddress(selected)) {
        setError("Für diesen Kunden ist keine Rechnungsadresse hinterlegt.");
        return null;
      }
      const match = selected.properties.find(
        (p) => p.isActive && propertyMatchesBilling(p, selected)
      );
      if (match) {
        return { customerId: form.customerId, propertyId: match.id };
      }
      street = selected.billingStreet!;
      zipCode = selected.billingZipCode!;
      city = selected.billingCity!;
      label = "Ausführungsadresse (wie Rechnung)";
    } else if (!street || !zipCode || !city) {
      setError("Bitte Straße, PLZ und Ort der Ausführungsadresse angeben.");
      return null;
    }

    setCreatingProperty(true);
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: form.customerId,
        label,
        street,
        zipCode,
        city,
        travelZoneId,
      }),
    });
    const data = await res.json();
    setCreatingProperty(false);
    if (!data.success) {
      setError(data.error ?? "Ausführungsadresse konnte nicht angelegt werden");
      return null;
    }
    await reloadCustomers();
    return { customerId: form.customerId, propertyId: data.data.id };
  }

  function selectCustomer(customerId: string) {
    const c = customers.find((x) => x.id === customerId);
    const primary = c?.properties.find((p) => p.isActive && p.isPrimary);
    const first = c?.properties.find((p) => p.isActive);
    setSiteMode("existing");
    setForm((f) => ({
      ...f,
      customerId,
      propertyId: primary?.id ?? first?.id ?? "",
      projectId: "",
      newSite: { label: "Baustelle", street: "", zipCode: "", city: "", travelZoneId: "" },
    }));
  }

  async function submit() {
    setSaving(true);
    setError("");
    const ids = await ensureCustomer();
    if (!ids) { setSaving(false); return; }

    const res = await fetch("/api/orders/wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...ids,
        title: form.title || form.orderTypeCustom || form.orderTypeName || "Neuer Auftrag",
        orderTypeId: form.orderTypeId,
        orderTypeCustom: form.orderTypeIsOther ? form.orderTypeCustom : undefined,
        description: form.description,
        projectId: form.projectId || undefined,
        serviceIds: form.serviceIds,
        customServices: form.customServices
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name,
            description: c.description || undefined,
            quantity: c.quantity,
            unitPriceCents: c.price != null ? Math.round(c.price * 100) : undefined,
            notes: c.notes || undefined,
          })),
        employeeIds: form.employeeIds,
        scheduledStart: form.scheduledStart || undefined,
        scheduledEnd: form.scheduledEnd || undefined,
        confirmMaterial: form.confirmMaterial,
        materialLines: materialLines
          .filter((l) => l.name.trim())
          .map((l) => ({
            articleId: l.articleId,
            sourceServiceId: l.sourceServiceId,
            name: l.name,
            quantityRequired: l.quantityRequired,
            unit: l.unit,
            unitPriceNet: l.unitPriceNet,
            notes: l.notes || undefined,
            isTool: false,
          })),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      router.push(`/dashboard/auftraege/${data.data.id}`);
    } else {
      setError(data.error ?? "Auftrag konnte nicht angelegt werden");
    }
  }

  function toggleService(id: string) {
    setMaterialTouched(false);
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((x) => x !== id) : [...f.serviceIds, id],
    }));
  }

  function addCustomService() {
    setForm((f) => ({
      ...f,
      customServices: [...f.customServices, { name: "", description: "", quantity: 1, price: null, notes: "" }],
    }));
  }

  function updateCustomService(index: number, patch: Partial<CustomService>) {
    setForm((f) => ({
      ...f,
      customServices: f.customServices.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function removeCustomService(index: number) {
    setForm((f) => ({ ...f, customServices: f.customServices.filter((_, i) => i !== index) }));
  }

  const hasCustomService = form.customServices.some((c) => c.name.trim());
  const selectedCustomer = customers.find((c) => c.id === form.customerId);

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/dashboard/auftraege" className="text-sm text-[#0d5c63] flex items-center gap-1 mb-4">
        <ChevronLeft className="h-4 w-4" /> Zurück zu Aufträgen
      </Link>

      <h1 className="text-2xl font-bold mb-2">Neuer Auftrag</h1>
      <p className="text-slate-500 text-sm mb-6">Assistent: Typ → Kunde → Leistung → Material → Termin → Freigabe</p>

      <div className="flex gap-1 overflow-x-auto mb-6 pb-1">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              i === step ? "bg-[#0d5c63] text-white ring-2 ring-[#0d5c63]/30" : "bg-slate-100 text-slate-600 hover:bg-[#0d5c63]/10 hover:text-[#0d5c63]"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {step === 0 && (
        <Card title="Auftragstyp">
          <div className="space-y-4">
            <OrderTypeSelect
              valueId={form.orderTypeId}
              customValue={form.orderTypeCustom}
              onChange={({ orderTypeId, orderTypeCustom, isOther, name }) => {
                setForm((f) => ({
                  ...f,
                  orderTypeId,
                  orderTypeCustom,
                  orderTypeIsOther: isOther,
                  orderTypeName: name,
                }));
              }}
            />
            <Input label="Auftragstitel *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z. B. Tür montieren Müller" />
            <Textarea label="Beschreibung" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card title="Kunde, Rechnung & Ausführungsadresse">
          <p className="text-sm text-slate-500 mb-4">
            Die Rechnungsadresse gehört zum Kunden. Die Ausführungsadresse / Baustelle gehört zum
            Auftrag und steuert Anfahrt sowie Zonen.
          </p>
          <label className="flex items-center gap-2 text-sm mb-4">
            <input
              type="checkbox"
              checked={form.createNewCustomer}
              onChange={(e) => setForm({ ...form, createNewCustomer: e.target.checked })}
            />
            Neuen Kunden anlegen
          </label>
          {form.createNewCustomer ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Vorname *"
                  value={form.newCustomer.firstName}
                  onChange={(e) =>
                    setForm({ ...form, newCustomer: { ...form.newCustomer, firstName: e.target.value } })
                  }
                />
                <Input
                  label="Nachname *"
                  value={form.newCustomer.lastName}
                  onChange={(e) =>
                    setForm({ ...form, newCustomer: { ...form.newCustomer, lastName: e.target.value } })
                  }
                />
                <Input
                  label="E-Mail"
                  type="email"
                  value={form.newCustomer.email}
                  onChange={(e) =>
                    setForm({ ...form, newCustomer: { ...form.newCustomer, email: e.target.value } })
                  }
                />
                <Input
                  label="Telefon"
                  value={form.newCustomer.phone}
                  onChange={(e) =>
                    setForm({ ...form, newCustomer: { ...form.newCustomer, phone: e.target.value } })
                  }
                />
              </div>
              <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                <p className="text-sm font-medium text-slate-800">Rechnungsadresse *</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Straße *"
                    className="sm:col-span-2"
                    value={form.newCustomer.billingStreet}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        newCustomer: { ...form.newCustomer, billingStreet: e.target.value },
                      })
                    }
                  />
                  <Input
                    label="PLZ *"
                    value={form.newCustomer.billingZipCode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        newCustomer: { ...form.newCustomer, billingZipCode: e.target.value },
                      })
                    }
                  />
                  <Input
                    label="Ort *"
                    value={form.newCustomer.billingCity}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        newCustomer: { ...form.newCustomer, billingCity: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.sameSiteAsBilling}
                  onChange={(e) => setForm({ ...form, sameSiteAsBilling: e.target.checked })}
                />
                <span>Ausführungsadresse = Rechnungsadresse übernehmen</span>
              </label>
              {!form.sameSiteAsBilling && (
                <div className="rounded-lg border border-[#0d5c63]/30 bg-[#0d5c63]/5 p-3 space-y-3">
                  <p className="text-sm font-medium text-[#0d5c63]">Ausführungsadresse / Baustelle *</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Bezeichnung"
                      className="sm:col-span-2"
                      value={form.newCustomer.siteLabel}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          newCustomer: { ...form.newCustomer, siteLabel: e.target.value },
                        })
                      }
                      placeholder="z. B. Baustelle Friedrichstraße"
                    />
                    <Input
                      label="Straße *"
                      className="sm:col-span-2"
                      value={form.newCustomer.siteStreet}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          newCustomer: { ...form.newCustomer, siteStreet: e.target.value },
                        })
                      }
                    />
                    <Input
                      label="PLZ *"
                      value={form.newCustomer.siteZipCode}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          newCustomer: { ...form.newCustomer, siteZipCode: e.target.value },
                        })
                      }
                    />
                    <Input
                      label="Ort *"
                      value={form.newCustomer.siteCity}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          newCustomer: { ...form.newCustomer, siteCity: e.target.value },
                        })
                      }
                    />
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium">Anfahrtszone (optional)</label>
                      <select
                        className="w-full h-10 rounded-lg border mt-1 px-3 text-sm"
                        value={form.newCustomer.siteTravelZoneId}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            newCustomer: {
                              ...form.newCustomer,
                              siteTravelZoneId: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Keine Zone</option>
                        {travelZones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <select
                className="w-full h-10 rounded-lg border px-3 text-sm mb-3"
                value={form.customerId}
                onChange={(e) => selectCustomer(e.target.value)}
              >
                <option value="">Kunde wählen...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company?.trim()
                      ? `${c.company} (${c.firstName} ${c.lastName})`
                      : `${c.firstName} ${c.lastName}`}
                  </option>
                ))}
              </select>
              {selectedCustomer && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Rechnungsadresse
                    </p>
                    <p className="mt-1 text-slate-800">
                      {hasBillingAddress(selectedCustomer)
                        ? formatBillingAddressOneLine(selectedCustomer)
                        : "Keine Rechnungsadresse hinterlegt – bitte beim Kunden ergänzen."}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Ausführungsadresse / Baustelle *</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap mb-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="siteMode"
                          checked={siteMode === "existing"}
                          onChange={() => setSiteMode("existing")}
                        />
                        Vorhandene wählen
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="siteMode"
                          checked={siteMode === "billing"}
                          onChange={() => setSiteMode("billing")}
                          disabled={!hasBillingAddress(selectedCustomer)}
                        />
                        Rechnungsadresse übernehmen
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="siteMode"
                          checked={siteMode === "new"}
                          onChange={() => setSiteMode("new")}
                        />
                        Neue Adresse erfassen
                      </label>
                    </div>

                    {siteMode === "existing" && (
                      <>
                        <select
                          className="w-full h-10 rounded-lg border px-3 text-sm"
                          value={form.propertyId}
                          onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
                        >
                          <option value="">Adresse wählen...</option>
                          {selectedCustomer.properties
                            .filter((p) => p.isActive)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label}: {p.street}, {p.zipCode} {p.city}
                                {p.travelZone ? ` · Zone: ${p.travelZone.name}` : " · keine Zone"}
                              </option>
                            ))}
                        </select>
                        {!selectedCustomer.properties.some((p) => p.isActive) && (
                          <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                            Keine gespeicherten Ausführungsadressen – bitte eine neue erfassen oder die
                            Rechnungsadresse übernehmen.
                          </p>
                        )}
                      </>
                    )}

                    {siteMode === "billing" && (
                      <p className="text-sm text-slate-600 rounded-lg border border-[#0d5c63]/20 bg-[#0d5c63]/5 px-3 py-2">
                        Als Ausführungsadresse wird verwendet:{" "}
                        <strong>{formatBillingAddressOneLine(selectedCustomer)}</strong>
                      </p>
                    )}

                    {siteMode === "new" && (
                      <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-slate-200 p-3">
                        <Input
                          label="Bezeichnung"
                          className="sm:col-span-2"
                          value={form.newSite.label}
                          onChange={(e) =>
                            setForm({ ...form, newSite: { ...form.newSite, label: e.target.value } })
                          }
                          placeholder="z. B. Baustelle Friedrichstraße"
                        />
                        <Input
                          label="Straße *"
                          className="sm:col-span-2"
                          value={form.newSite.street}
                          onChange={(e) =>
                            setForm({ ...form, newSite: { ...form.newSite, street: e.target.value } })
                          }
                        />
                        <Input
                          label="PLZ *"
                          value={form.newSite.zipCode}
                          onChange={(e) =>
                            setForm({ ...form, newSite: { ...form.newSite, zipCode: e.target.value } })
                          }
                        />
                        <Input
                          label="Ort *"
                          value={form.newSite.city}
                          onChange={(e) =>
                            setForm({ ...form, newSite: { ...form.newSite, city: e.target.value } })
                          }
                        />
                        <div className="sm:col-span-2">
                          <label className="text-sm font-medium">Anfahrtszone (optional)</label>
                          <select
                            className="w-full h-10 rounded-lg border mt-1 px-3 text-sm"
                            value={form.newSite.travelZoneId}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                newSite: { ...form.newSite, travelZoneId: e.target.value },
                              })
                            }
                          >
                            <option value="">Keine Zone</option>
                            {travelZones.map((z) => (
                              <option key={z.id} value={z.id}>
                                {z.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {siteMode === "existing" &&
                      form.propertyId &&
                      (() => {
                        const sel = selectedCustomer.properties.find((p) => p.id === form.propertyId);
                        if (sel && !sel.travelZone) {
                          return (
                            <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                              Dieser Ausführungsadresse ist keine Anfahrtszone zugeordnet. Anfahrtskosten
                              können dann nicht automatisch berechnet werden.
                            </p>
                          );
                        }
                        return null;
                      })()}
                  </div>
                </div>
              )}
            </>
          )}
          {(form.customerId || form.createNewCustomer) && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <ProjectAssignField
                customerId={form.createNewCustomer ? null : form.customerId || null}
                value={form.projectId}
                onChange={(projectId) => setForm((f) => ({ ...f, projectId }))}
                allowCreate={!form.createNewCustomer}
              />
              {form.createNewCustomer && (
                <p className="mt-1 text-xs text-slate-400">
                  Bei neuem Kunden kann das Projekt nach dem Anlegen in der Auftragsdetailansicht zugeordnet werden.
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {step === 2 && (
        <Card title="Leistungen wählen">
          <p className="text-sm text-slate-500 mb-4">Aus dem Leistungsverzeichnis – erzeugt automatisch Phasen und Materialvorschlag.</p>
          <div className="space-y-2">
            {services.map((s) => (
              <label key={s.id} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer ${form.serviceIds.includes(s.id) ? "border-[#0d5c63] bg-[#0d5c63]/5" : "border-slate-200"}`}>
                <input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} />
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.durationMinutes} Min.</p>
                </div>
              </label>
            ))}
            {!services.length && (
              <p className="text-sm text-slate-400">Noch keine Leistungen im Verzeichnis – nutzen Sie unten „Sonstige Leistung“.</p>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-sm">Sonstige Leistung</p>
                <p className="text-xs text-slate-500">Nicht im Verzeichnis? Hier frei erfassen – wird in Angebot/Rechnung übernommen.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addCustomService}>
                <Plus className="h-4 w-4 mr-1" /> Hinzufügen
              </Button>
            </div>

            <div className="space-y-3">
              {form.customServices.map((c, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <Input
                      label="Bezeichnung *"
                      className="flex-1"
                      value={c.name}
                      onChange={(e) => updateCustomService(i, { name: e.target.value })}
                      placeholder="z. B. Sonderanfertigung Blende"
                    />
                    <button type="button" onClick={() => removeCustomService(i)} className="text-red-500 mt-7 shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea
                    label="Beschreibung (optional)"
                    value={c.description}
                    onChange={(e) => updateCustomService(i, { description: e.target.value })}
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput
                      label="Menge"
                      allowDecimal={false}
                      min={1}
                      value={c.quantity}
                      onValueChange={(v) => updateCustomService(i, { quantity: v ?? 1 })}
                    />
                    <NumberInput
                      label="Preis (netto, optional)"
                      suffix="€"
                      value={c.price}
                      onValueChange={(v) => updateCustomService(i, { price: v })}
                      placeholder="z. B. 120"
                    />
                  </div>
                  <Input
                    label="Interne Notiz (optional)"
                    value={c.notes}
                    onChange={(e) => updateCustomService(i, { notes: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card title="Material">
          <p className="text-sm text-slate-500 mb-4">
            Vorschläge aus dem Leistungsverzeichnis können Sie ergänzen, anpassen oder löschen.
            Preise und Mengen fließen später in die Kalkulation ein. Reservierung erst in Schritt 6.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadMaterialSuggestions(true)}
            >
              Vorschläge aus Leistungen neu laden
            </Button>
          </div>
          <OrderMaterialEditor
            compact
            lines={materialLines}
            articles={articles}
            onChange={(next) => {
              setMaterialTouched(true);
              setMaterialLines(next);
            }}
          />
        </Card>
      )}

      {step === 4 && (
        <Card title="Termin & Mitarbeiter (optional)">
          {form.scheduledStart && form.employeeIds.length === 0 && (
            <p className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Hinweis: Ohne Mitarbeiter-Zuweisung erscheint der Termin nicht im Monteur-Tagesplan.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <EmployeeMultiSelect
                label="Mitarbeiter (Mehrfachauswahl)"
                employees={employees.map((e) => ({
                  id: e.id,
                  firstName: e.user.firstName,
                  lastName: e.user.lastName,
                }))}
                value={form.employeeIds}
                onChange={(ids) => setForm({ ...form, employeeIds: ids })}
              />
            </div>
            <Input label="Beginn" type="datetime-local" value={form.scheduledStart} onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} />
            <Input label="Ende" type="datetime-local" value={form.scheduledEnd} onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })} />
          </div>
        </Card>
      )}

      {step === 5 && (
        <Card title="Freigabe">
          <ul className="text-sm space-y-2 mb-4">
            <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> {form.orderTypeIsOther && form.orderTypeCustom.trim() ? form.orderTypeCustom.trim() : (form.orderTypeName || "Auftragstyp")}</li>
            <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> {form.title || "—"}</li>
            <li className="flex gap-2">
              <Check className="h-4 w-4 text-green-600" />{" "}
              {form.projectId ? "Projekt zugeordnet" : "Ohne Projekt"}
            </li>
            <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> {form.serviceIds.length + form.customServices.filter((c) => c.name.trim()).length} Leistung(en){hasCustomService ? ` (inkl. ${form.customServices.filter((c) => c.name.trim()).length} sonstige)` : ""}</li>
            <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> {materialLines.filter((l) => l.name.trim()).length} Materialposition(en)</li>
            <li className="flex gap-2"><Check className="h-4 w-4 text-green-600" /> Phasen werden automatisch erzeugt</li>
            <li className="flex gap-2">
              <Check className="h-4 w-4 text-green-600" />{" "}
              {form.employeeIds.length
                ? `${form.employeeIds.length} Mitarbeiter zugewiesen`
                : "Keine Mitarbeiter zugewiesen"}
            </li>
          </ul>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.confirmMaterial} onChange={(e) => setForm({ ...form, confirmMaterial: e.target.checked })} />
            <span>Material jetzt reservieren (nur wenn Bestand im Hauptlager vorhanden)</span>
          </label>
          <Button className="mt-6 w-full" variant="action" onClick={submit} disabled={saving || creatingProperty}>
            {saving || creatingProperty ? "Wird angelegt..." : "Auftrag anlegen"}
          </Button>
        </Card>
      )}

      <div className="flex justify-between mt-6">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ChevronLeft className="h-4 w-4" /> Zurück
        </Button>
        {step < STEPS.length - 1 && (
          <Button
            variant="outline"
            onClick={() => {
              setError("");
              if (step === 0 && !form.title) { setError("Bitte Auftragstitel eingeben."); return; }
              if (step === 0 && !form.orderTypeId) { setError("Bitte einen Auftragstyp wählen."); return; }
              if (step === 0 && form.orderTypeIsOther && !form.orderTypeCustom.trim()) {
                setError("Bitte den Auftragstyp unter „Sonstiges“ beschreiben.");
                return;
              }
              if (step === 1) {
                if (form.createNewCustomer) {
                  const nc = form.newCustomer;
                  if (!nc.firstName || !nc.lastName || !nc.billingStreet || !nc.billingZipCode || !nc.billingCity) {
                    setError("Bitte Name und Rechnungsadresse ausfüllen.");
                    return;
                  }
                  if (!form.sameSiteAsBilling && (!nc.siteStreet || !nc.siteZipCode || !nc.siteCity)) {
                    setError("Bitte die Ausführungsadresse ausfüllen.");
                    return;
                  }
                } else {
                  if (!form.customerId) { setError("Bitte einen Kunden wählen."); return; }
                  if (siteMode === "existing" && !form.propertyId) {
                    setError("Bitte eine Ausführungsadresse wählen.");
                    return;
                  }
                  if (siteMode === "new" && (!form.newSite.street || !form.newSite.zipCode || !form.newSite.city)) {
                    setError("Bitte Straße, PLZ und Ort der Ausführungsadresse angeben.");
                    return;
                  }
                  if (siteMode === "billing" && selectedCustomer && !hasBillingAddress(selectedCustomer)) {
                    setError("Keine Rechnungsadresse vorhanden.");
                    return;
                  }
                }
              }
              if (step === 2 && !form.serviceIds.length && !hasCustomService) { setError("Bitte mindestens eine Leistung wählen oder eine sonstige Leistung erfassen."); return; }
              setStep((s) => s + 1);
            }}
          >
            Weiter <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
