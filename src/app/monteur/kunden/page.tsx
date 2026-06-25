"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mail, Phone, MapPin, Search } from "lucide-react";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  primaryAddress: string | null;
}

function matchesSearch(c: Customer, q: string) {
  const hay = [
    c.firstName,
    c.lastName,
    c.company,
    c.email,
    c.phone,
    c.primaryAddress,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export default function MonteurKundenPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/monteur/customers")
      .then((r) => r.json())
      .then((d) => { if (d.success) setCustomers(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => matchesSearch(c, q));
  }, [customers, search]);

  if (loading) return <p className="text-slate-500">Laden…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Kunden</h1>
        <p className="text-sm text-slate-500 mt-1">Aus Ihren eigenen Terminen</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Name, Firma, E-Mail, Adresse…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {customers.length === 0 ? (
        <Card><p className="text-center text-slate-500 py-8">Noch keine Kunden in Ihren Terminen.</p></Card>
      ) : filtered.length === 0 ? (
        <Card><p className="text-center text-slate-500 py-8">Keine Treffer für &quot;{search}&quot;.</p></Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <Card className="!p-4">
                <p className="font-semibold text-slate-900">
                  {c.firstName} {c.lastName}
                  {c.company && <span className="text-sm font-normal text-slate-500"> · {c.company}</span>}
                </p>
                {c.primaryAddress && (
                  <p className="text-sm text-slate-600 flex items-start gap-2 mt-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" /> {c.primaryAddress}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 mt-3">
                  <a href={`mailto:${c.email}`} className="text-sm text-[#0d5c63] flex items-center gap-1">
                    <Mail className="h-4 w-4" /> {c.email}
                  </a>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="text-sm text-[#0d5c63] flex items-center gap-1">
                      <Phone className="h-4 w-4" /> {c.phone}
                    </a>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-center text-slate-400">
        Vollständige Kundenverwaltung im{" "}
        <Link href="/dashboard/kunden" className="text-[#0d5c63] underline">Büro-Dashboard</Link>
      </p>
    </div>
  );
}
