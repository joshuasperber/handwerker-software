"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { Building2, MapPin, Mail, Phone, Plus, User } from "lucide-react";
import { swrKeys, useApiSWR } from "@/lib/swr";

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Kunden</h1>
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
      {isLoading && customers.length === 0 && (
        <p className="text-sm text-slate-500 mb-4">Kunden werden geladen…</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {customers.map((c) => {
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
    </div>
  );
}
