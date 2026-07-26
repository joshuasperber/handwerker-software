"use client";

import { Mail, MapPin, Phone, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { orderServiceLabel } from "@/lib/utils";
import {
  formatBillingAddressOneLine,
  formatSiteAddressOneLine,
  hasBillingAddress,
} from "@/lib/addresses/billing-vs-site";

export interface OrderCustomerSectionProps {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    company?: string | null;
    billingStreet?: string | null;
    billingZipCode?: string | null;
    billingCity?: string | null;
  };
  property: {
    street: string;
    zipCode: string;
    city: string;
    label?: string | null;
  };
  services: {
    service: { name: string; durationMinutes: number } | null;
    customName?: string | null;
    description?: string | null;
    quantity?: number;
    unitPriceCents?: number | null;
  }[];
  description: string | null;
}

export function OrderCustomerSection({
  customer,
  property,
  services,
  description,
}: OrderCustomerSectionProps) {
  const billing = formatBillingAddressOneLine(customer);
  const site = formatSiteAddressOneLine(property);
  const siteLabel = property.label?.trim() || "Ausführungsadresse / Baustelle";

  return (
    <>
      <Card title="Kunde & Adressen">
        <div className="space-y-4">
          <div>
            <p className="font-medium">
              {customer.company?.trim()
                ? customer.company
                : `${customer.firstName} ${customer.lastName}`}
            </p>
            {customer.company?.trim() && (
              <p className="text-sm text-slate-500">
                {customer.firstName} {customer.lastName}
              </p>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-2">
              <Mail className="h-4 w-4 shrink-0" /> {customer.email}
            </div>
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Phone className="h-4 w-4 shrink-0" /> {customer.phone}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Rechnungsadresse
              </p>
              <p className="text-sm text-slate-800 mt-1.5">
                {hasBillingAddress(customer) ? billing : "Keine Rechnungsadresse hinterlegt"}
              </p>
            </div>
            <div className="rounded-lg border border-[#0d5c63]/25 bg-[#0d5c63]/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#0d5c63] flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {siteLabel}
              </p>
              <p className="text-sm text-slate-800 mt-1.5">{site || "—"}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Anfahrt &amp; Zonen beziehen sich auf diese Adresse
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Leistungen">
        {services.map((service, index) => (
          <div
            key={index}
            className="flex justify-between py-2 border-b border-slate-50 last:border-0"
          >
            <span>
              {orderServiceLabel(service)}
              {!service.service && (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-600">
                  sonstige
                </span>
              )}
              {service.description && (
                <span className="block text-xs text-slate-400">{service.description}</span>
              )}
            </span>
            <span className="text-slate-400">
              {service.service
                ? `${service.service.durationMinutes} Min.`
                : service.unitPriceCents != null
                  ? `${(service.unitPriceCents / 100).toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })}`
                  : `${service.quantity ?? 1}×`}
            </span>
          </div>
        ))}
        {description && <p className="mt-3 text-sm text-slate-600">{description}</p>}
      </Card>
    </>
  );
}
