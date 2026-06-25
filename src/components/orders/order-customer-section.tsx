"use client";

import { Mail, MapPin, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { orderServiceLabel } from "@/lib/utils";

export interface OrderCustomerSectionProps {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  property: {
    street: string;
    zipCode: string;
    city: string;
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
  return (
    <>
      <Card title="Kunde & Einsatzort">
        <div className="space-y-3">
          <p className="font-medium">
            {customer.firstName} {customer.lastName}
          </p>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Mail className="h-4 w-4" /> {customer.email}
          </div>
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Phone className="h-4 w-4" /> {customer.phone}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <MapPin className="h-4 w-4" />
            {property.street}, {property.zipCode} {property.city}
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
                  ? `${(service.unitPriceCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`
                  : `${service.quantity ?? 1}×`}
            </span>
          </div>
        ))}
        {description && <p className="mt-3 text-sm text-slate-600">{description}</p>}
      </Card>
    </>
  );
}
