"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { MapPin, Mail, Phone } from "lucide-react";
import { swrKeys, useApiSWR } from "@/lib/swr";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
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
          <AddButton href="/dashboard/kunden/neu">Neuer Kunde</AddButton>
        </CanAccess>
      </div>
      {isLoading && customers.length === 0 && (
        <p className="text-sm text-slate-500 mb-4">Kunden werden geladen…</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {customers.map((c) => (
          <Link key={c.id} href={`/dashboard/kunden/${c.id}`}>
            <Card className="hover:shadow-md transition-shadow h-full">
              <h3 className="font-semibold text-slate-900">
                {c.firstName} {c.lastName}
              </h3>
              {c.company && <p className="text-sm text-slate-500">{c.company}</p>}
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
        ))}
      </div>
    </div>
  );
}
