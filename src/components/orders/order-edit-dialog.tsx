"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/fetch-json";
import { saveJson } from "@/lib/save-toast";

type CustomerOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company?: string | null;
  billingStreet?: string | null;
  billingZipCode?: string | null;
  billingCity?: string | null;
  properties: Array<{
    id: string;
    customerId: string;
    label?: string | null;
    street: string;
    zipCode: string;
    city: string;
    isActive: boolean;
  }>;
};

type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  isActive?: boolean;
};

type CustomServiceDraft = {
  key: string;
  name: string;
  description: string;
  quantity: number;
  price: string;
  notes: string;
};

export type OrderEditSource = {
  id: string;
  title?: string | null;
  description: string | null;
  customerId?: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  customer: Omit<CustomerOption, "properties">;
  property: CustomerOption["properties"][number];
  services: Array<{
    id?: string;
    serviceId?: string | null;
    service: ServiceOption | null;
    customName?: string | null;
    description?: string | null;
    quantity?: number;
    unitPriceCents?: number | null;
    notes?: string | null;
  }>;
};

export type OrderEditPatch = Pick<
  OrderEditSource,
  "title" | "description" | "scheduledStart" | "scheduledEnd" | "customer" | "property" | "services"
> & {
  customerId: string;
  projectId?: null;
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function customerLabel(customer: CustomerOption) {
  return customer.company?.trim()
    ? `${customer.company} · ${customer.firstName} ${customer.lastName}`
    : `${customer.firstName} ${customer.lastName}`;
}

export function OrderEditDialog({
  open,
  onOpenChange,
  order,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderEditSource;
  onSaved: (patch: OrderEditPatch) => void;
}) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState(() => order.title ?? "");
  const [description, setDescription] = useState(() => order.description ?? "");
  const [customerId, setCustomerId] = useState(
    () => order.customerId ?? order.property.customerId
  );
  const [propertyId, setPropertyId] = useState(() => order.property.id);
  const [serviceIds, setServiceIds] = useState<string[]>(() =>
    order.services.flatMap((entry) => entry.serviceId ? [entry.serviceId] : [])
  );
  const [customServices, setCustomServices] = useState<CustomServiceDraft[]>(() =>
    order.services.flatMap((entry, index) => entry.serviceId ? [] : [{
      key: entry.id ?? `existing-${index}`,
      name: entry.customName ?? "",
      description: entry.description ?? "",
      quantity: entry.quantity ?? 1,
      price: entry.unitPriceCents == null ? "" : String(entry.unitPriceCents / 100),
      notes: entry.notes ?? "",
    }])
  );
  const [scheduledStart, setScheduledStart] = useState(() =>
    toLocalDateTime(order.scheduledStart)
  );
  const [scheduledEnd, setScheduledEnd] = useState(() =>
    toLocalDateTime(order.scheduledEnd)
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([
      fetchJson<CustomerOption[]>("/api/customers"),
      fetchJson<ServiceOption[]>("/api/services?includeInactive=1"),
    ]).then(([customerResult, serviceResult]) => {
      if (cancelled) return;
      if (customerResult.success && customerResult.data) setCustomers(customerResult.data);
      if (serviceResult.success && serviceResult.data) setServices(serviceResult.data);
      if (!customerResult.success || !serviceResult.success) {
        setError("Kunden oder Leistungen konnten nicht geladen werden.");
      }
      setLoadingOptions(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const properties = selectedCustomer?.properties.filter(
    (property) => property.isActive || property.id === propertyId
  ) ?? [];

  function changeCustomer(nextCustomerId: string) {
    const nextCustomer = customers.find((customer) => customer.id === nextCustomerId);
    const currentPropertyBelongsToCustomer = nextCustomer?.properties.some(
      (property) => property.id === propertyId && property.isActive
    );
    setCustomerId(nextCustomerId);
    if (!currentPropertyBelongsToCustomer) {
      setPropertyId(nextCustomer?.properties.find((property) => property.isActive)?.id ?? "");
    }
  }

  function toggleService(serviceId: string) {
    setServiceIds((current) => current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId]
    );
  }

  function updateCustomService(index: number, patch: Partial<CustomServiceDraft>) {
    setCustomServices((current) => current.map((service, currentIndex) =>
      currentIndex === index ? { ...service, ...patch } : service
    ));
  }

  async function save() {
    const cleanTitle = title.trim();
    const cleanCustomServices = customServices.filter((service) => service.name.trim());
    if (!cleanTitle) return setError("Bitte einen Auftragstitel angeben.");
    if (!customerId || !propertyId) {
      return setError("Bitte Kunde und Ausführungsadresse auswählen.");
    }
    if (!serviceIds.length && !cleanCustomServices.length) {
      return setError("Bitte mindestens eine Leistung auswählen.");
    }
    const hasInvalidCustomService = cleanCustomServices.some((service) => {
      const price = service.price.trim()
        ? Number(service.price.replace(",", "."))
        : null;
      return !Number.isInteger(service.quantity) || service.quantity <= 0 ||
        (price !== null && (!Number.isFinite(price) || price < 0));
    });
    if (hasInvalidCustomService) {
      return setError("Bitte Menge und Preis der zusätzlichen Leistungen prüfen.");
    }
    if (scheduledStart && scheduledEnd && new Date(scheduledEnd) <= new Date(scheduledStart)) {
      return setError("Das Terminende muss nach dem Beginn liegen.");
    }

    const customer = customers.find((entry) => entry.id === customerId);
    const property = customer?.properties.find((entry) => entry.id === propertyId);
    if (!customer || !property) return setError("Kunde oder Ausführungsadresse fehlt.");

    setSaving(true);
    setError("");
    const result = await saveJson(
      `/api/orders/${order.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          description: description.trim() || null,
          customerId,
          propertyId,
          serviceIds,
          customServices: cleanCustomServices.map((service) => ({
            name: service.name.trim(),
            description: service.description.trim() || null,
            quantity: service.quantity,
            unitPriceCents: service.price.trim()
              ? Math.round(Number(service.price.replace(",", ".")) * 100)
              : null,
            notes: service.notes.trim() || null,
          })),
          scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : null,
          scheduledEnd: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
        }),
      },
      {
        loading: "Auftrag wird gespeichert …",
        success: "Auftrag aktualisiert",
        error: "Auftrag konnte nicht gespeichert werden",
      }
    );
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? "Auftrag konnte nicht gespeichert werden.");
      return;
    }

    const catalogServices = serviceIds.flatMap((serviceId) => {
      const service = services.find((entry) => entry.id === serviceId);
      return service ? [{ serviceId, service }] : [];
    });
    const customServicePatch = cleanCustomServices.map((service) => ({
      serviceId: null,
      service: null,
      customName: service.name.trim(),
      description: service.description.trim() || null,
      quantity: service.quantity,
      unitPriceCents: service.price.trim()
        ? Math.round(Number(service.price.replace(",", ".")) * 100)
        : null,
      notes: service.notes.trim() || null,
    }));

    onSaved({
      title: cleanTitle,
      description: description.trim() || null,
      customerId,
      customer,
      property,
      services: [...catalogServices, ...customServicePatch],
      scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : null,
      scheduledEnd: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
      ...(customerId !== (order.customerId ?? order.property.customerId)
        ? { projectId: null }
        : {}),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Auftrag bearbeiten</DialogTitle>
          <DialogDescription>
            Stammdaten, Baustelle, Leistungen und Termin gemeinsam aktualisieren.
          </DialogDescription>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500" role="status">
            <Loader2 className="h-5 w-5 animate-spin" /> Auswahldaten werden geladen …
          </div>
        ) : (
          <div className="space-y-5">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="space-y-3">
              <Input label="Auftragstitel *" value={title} onChange={(event) => setTitle(event.target.value)} />
              <Textarea label="Beschreibung" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Kunde *
                <select
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  value={customerId}
                  onChange={(event) => changeCustomer(event.target.value)}
                >
                  <option value="">Kunde auswählen</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customerLabel(customer)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Ausführungsadresse / Baustelle *
                <select
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  value={propertyId}
                  onChange={(event) => setPropertyId(event.target.value)}
                  disabled={!customerId}
                >
                  <option value="">Adresse auswählen</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.label?.trim() || "Baustelle"} · {property.street}, {property.zipCode} {property.city}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Katalog-Leistungen *</legend>
              <div className="mt-2 grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                {services.map((service) => (
                  <label key={service.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={serviceIds.includes(service.id)}
                      onChange={() => toggleService(service.id)}
                    />
                    <span>
                      {service.name}{" "}
                      <span className="text-xs text-slate-400">
                        ({service.durationMinutes} Min.{service.isActive === false ? " · inaktiv" : ""})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Zusätzliche Leistungen</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCustomServices((current) => [...current, {
                    key: crypto.randomUUID(), name: "", description: "", quantity: 1, price: "", notes: "",
                  }])}
                >
                  <Plus className="mr-1 h-4 w-4" /> Hinzufügen
                </Button>
              </div>
              <div className="mt-2 space-y-3">
                {customServices.map((service, index) => (
                  <div key={service.key} className="rounded-xl border border-slate-200 p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_90px_120px_auto]">
                      <Input
                        label="Bezeichnung"
                        value={service.name}
                        onChange={(event) => updateCustomService(index, { name: event.target.value })}
                      />
                      <Input
                        label="Menge"
                        type="number"
                        min="1"
                        step="1"
                        value={service.quantity}
                        onChange={(event) => updateCustomService(index, { quantity: Number(event.target.value) })}
                      />
                      <Input
                        label="Preis netto (€)"
                        inputMode="decimal"
                        value={service.price}
                        onChange={(event) => updateCustomService(index, { price: event.target.value })}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="self-end text-red-600"
                        onClick={() => setCustomServices((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                        aria-label="Zusätzliche Leistung entfernen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Input
                        label="Beschreibung"
                        value={service.description}
                        onChange={(event) => updateCustomService(index, { description: event.target.value })}
                      />
                      <Input
                        label="Interne Notiz"
                        value={service.notes}
                        onChange={(event) => updateCustomService(index, { notes: event.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Terminbeginn" type="datetime-local" value={scheduledStart} onChange={(event) => setScheduledStart(event.target.value)} />
              <Input label="Terminende" type="datetime-local" value={scheduledEnd} onChange={(event) => setScheduledEnd(event.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" variant="action" disabled={saving || loadingOptions} onClick={() => void save()}>
            {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Speichern …</> : "Änderungen speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
