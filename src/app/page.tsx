import Link from "next/link";
import { Wrench, Calendar, Users, Smartphone, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0d5c63] text-white">
              <Wrench className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-slate-900">Handwerker App</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/buchen/demo">
              <Button variant="outline" size="sm">Termin buchen</Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Anmelden</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Die Handwerker-Software<br />
          <span className="text-[#0d5c63]">für KMU-Betriebe</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Online-Terminbuchung, Disposition, Monteur-App und Büro-Dashboard in einer
          DSGVO-konformen SaaS-Lösung. Skalierbar für Angebote, Rechnungen und KI-Funktionen.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/buchen/demo">
            <Button size="lg" variant="action">Demo-Buchung starten</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg">Dashboard öffnen</Button>
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

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        Handwerker App MVP · DSGVO-orientiert · Multi-Tenant SaaS
      </footer>
    </div>
  );
}
