"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { Building2, MapPin, Mail, Phone, Plus, Search, User, Users } from "lucide-react";
import { swrKeys, useApiSWR } from "@/lib/swr";
import { SearchField } from "@/components/ui/list-controls";
import { InfoButton } from "@/components/ui/info-button";
import { PageTitleIcon } from "@/components/ui/page-title-icon";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  customerType?: "PRIVAT" | "GEWERBLICH";
  properties: { street: string; city: string; zipCode: string }[];
  _count: { orders: number };
}

export default function KundenPage() {
  const { data: customers = [], isLoading } = useApiSWR<Customer[]>(swrKeys.customers());
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filteredCustomers = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase("de");
    if (!needle) return customers;

    return customers.filter((customer) => {
      const address = customer.properties
        .map((property) => `${property.street} ${property.zipCode} ${property.city}`)
        .join(" ");
      return [
        customer.firstName,
        customer.lastName,
        customer.company,
        customer.email,
        customer.phone,
        address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("de")
        .includes(needle);
    });
  }, [customers, deferredQuery]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <PageTitleIcon icon={Users} />
          Kunden
          <InfoButton title="Kunden" ariaLabel="Info zu Kunden">
            <p>Private und gewerbliche Kunden mit Kontaktdaten, Adressen und Aufträgen.</p>
          </InfoButton>
        </h1>
        <CanAccess permission="customers.write">
          <div className="flex flex-wrap gap-2">
            <AddButton href="/dashboard/kunden/neu">Privatkunde</AddButton>
            <Button asChild variant="outline" size="sm" className="shrink-0 sm:h-10 sm:px-5 sm:text-sm">
              <Link href="/dashboard/kunden/neu?type=business">
                <Plus className="size-4 shrink-0" />
                Business-Kunde
              </Link>
            </Button>
          </div>
        </CanAccess>
      </div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          label="Kunden durchsuchen"
          placeholder="Name, Firma, Ort oder Kontakt suchen …"
          value={query}
          onValueChange={setQuery}
          autoComplete="off"
          containerClassName="max-w-xl"
        />
        <p className="shrink-0 text-xs font-medium text-slate-500" aria-live="polite">
          {filteredCustomers.length} {filteredCustomers.length === 1 ? "Kunde" : "Kunden"}
        </p>
      </div>
      {isLoading && customers.length === 0 && (
        <p className="text-sm text-slate-500 mb-4">Kunden werden geladen…</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCustomers.map((c) => {
          const isBusiness = c.customerType === "GEWERBLICH";
          const title = isBusiness && c.company?.trim()
            ? c.company
            : `${c.firstName} ${c.lastName}`;
          const subtitle = isBusiness
            ? `${c.firstName} ${c.lastName}`
            : c.company;
          return (
            <Link key={c.id} href={`/dashboard/kunden/${c.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      isBusiness
                        ? "bg-[#0d5c63]/10 text-[#0d5c63]"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isBusiness ? (
                      <>
                        <Building2 className="h-3 w-3" /> Business
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3" /> Privat
                      </>
                    )}
                  </span>
                </div>
                {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="h-3.5 w-3.5" /> {c.email}
                  </div>
                  {c.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Phone className="h-3.5 w-3.5" /> {c.phone}
                    </div>
                  )}
                  {c.properties[0] && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.properties[0].street}, {c.properties[0].zipCode}{" "}
                      {c.properties[0].city}
                    </div>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-400">{c._count.orders} Aufträge</p>
              </Card>
            </Link>
          );
        })}
      </div>
      {!isLoading && filteredCustomers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
          <Search className="mx-auto h-6 w-6 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">Kein passender Kunde gefunden</p>
          <p className="mt-1 text-xs text-slate-500">
            Prüfe den Suchbegriff oder lösche den Filter.
          </p>
        </div>
      )}
    </div>
  );
}
