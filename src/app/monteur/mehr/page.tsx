"use client";

import Link from "next/link";
import {
  User,
  MessageSquare,
  Users,
  Package,
  ClipboardPlus,
  LayoutDashboard,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useSession } from "@/components/auth/can-access";
import { canSwitchAppViews } from "@/lib/permissions";
import { LogoutButton } from "@/components/auth/logout-button";
import type { UserRole } from "@/generated/prisma/enums";

const LINKS: {
  href: string;
  label: string;
  description: string;
  icon: typeof User;
}[] = [
  {
    href: "/monteur/profil",
    label: "Profil",
    description: "Name, Kontakt, Passwort, Profilbild",
    icon: User,
  },
  {
    href: "/monteur/nachrichten",
    label: "Nachrichten",
    description: "Team-Chat und Mitteilungen",
    icon: MessageSquare,
  },
  {
    href: "/monteur/mitarbeiter",
    label: "Team",
    description: "Mitarbeiter, Partner, Aufträge und Kalender",
    icon: Users,
  },
  {
    href: "/monteur/material",
    label: "Materialübersicht",
    description: "Bedarf und Entnahmen im Kontext",
    icon: Package,
  },
  {
    href: "/monteur/anfrage",
    label: "Neue Anfrage / Zusatzarbeit",
    description: "Meldung an Büro oder Admin",
    icon: ClipboardPlus,
  },
];

export default function MonteurMehrPage() {
  const session = useSession();
  const role = (session?.role ?? "MONTEUR") as UserRole;
  const showAdminSwitch = canSwitchAppViews(role);

  async function switchToVerwaltung() {
    await fetch("/api/app-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view: "verwaltung" }),
    });
    window.location.href = "/dashboard";
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Mehr</h1>
        <p className="text-sm text-slate-500">
          Profil, Nachrichten und weitere Funktionen
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#0d5c63]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900">{item.label}</span>
                <span className="block text-xs text-slate-500">{item.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </Link>
          );
        })}
      </div>

      {showAdminSwitch && (
        <button
          type="button"
          onClick={() => void switchToVerwaltung()}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#0d5c63]/30 bg-[#0d5c63]/5 px-4 py-3.5 text-left active:scale-[0.99]"
        >
          <LayoutDashboard className="h-5 w-5 text-[#0d5c63]" />
          <span>
            <span className="block font-medium text-[#0d5c63]">Zur Verwaltung wechseln</span>
            <span className="block text-xs text-slate-600">
              Nur sichtbar, wenn beide Ansichten erlaubt sind
            </span>
          </span>
        </button>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <LogoutButton
          label="Abmelden"
          className="flex w-full items-center justify-center gap-2 min-h-11 rounded-xl text-red-600 hover:bg-red-50"
        />
        <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-slate-400">
          <LogOut className="h-3 w-3" /> Sitzung beenden
        </p>
      </div>
    </div>
  );
}
