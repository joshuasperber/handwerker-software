import Link from "next/link";
import Image from "next/image";
import { Wrench, Calendar, Users, Smartphone, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LegalFooter } from "@/components/legal/legal-footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Image
              src="/icons/icon-192.png"
              alt="JoMaster Logo"
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg"
            />
            <span className="text-lg font-bold text-slate-900">JoMaster</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/registrieren">
              <Button variant="outline" size="sm">Betrieb anlegen</Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Anmelden</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          JoMaster<br />
          <span className="text-[#0d5c63]">für KMU-Handwerksbetriebe</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Online-Terminbuchung, Disposition, Monteur-App und Büro-Dashboard in einer
          Multi-Tenant-SaaS-Lösung. Skalierbar für Angebote, Rechnungen und KI-Funktionen.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/registrieren">
            <Button size="lg" variant="action">Kostenlos starten</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg">Anmelden</Button>
          </Link>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-slate-900">Alles in einer Plattform</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Calendar, title: "Online-Buchung", desc: "Website-Widget mit Verfügbarkeitsberechnung, Fotos und DSGVO-Einwilligung" },
              { icon: Users, title: "Büro-Dashboard", desc: "Kunden, Aufträge, Termine, Mitarbeiter und Nachrichten zentral verwalten" },
              { icon: Smartphone, title: "Monteur-PWA", desc: "Tagesplan, Checklisten, Arbeitszeit, Material und Abschlussdokumentation mobil" },
              { icon: Clock, title: "Intelligente Planung", desc: "Arbeitszeiten, Einsatzgebiet, Qualifikationen und Pufferzeiten berücksichtigt" },
              { icon: Shield, title: "Rollen & Audit", desc: "Admin, Meister, Büro, Monteur und Kunde mit vollständigem Änderungsprotokoll" },
              { icon: Wrench, title: "Erweiterbar", desc: "Vorbereitet für Angebote, Rechnungen, Wartungsverträge und KI-Assistenten" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LegalFooter />
    </div>
  );
}
