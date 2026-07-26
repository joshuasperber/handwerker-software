"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { swrKeys, useApiSWR } from "@/lib/swr";
import { CheckCircle2, Circle, Copy, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";

type OnboardingStatus = {
  showChecklist: boolean;
  complete: boolean;
  bookingUrl: string | null;
  companyName: string | null;
  steps: {
    hasService: boolean;
    hasTeamMember: boolean;
    hasBookingLink: boolean;
    hasAddress: boolean;
    hasLogo: boolean;
    hasImprint: boolean;
  };
};

const CORE_STEPS: {
  key: keyof OnboardingStatus["steps"];
  title: string;
  hint: string;
  href: string;
}[] = [
  {
    key: "hasService",
    title: "Erste Leistung anlegen",
    hint: "Damit Kunden online buchen können",
    href: "/dashboard/leistungen",
  },
  {
    key: "hasTeamMember",
    title: "Mitarbeiter einladen",
    hint: "Büro, Meister oder Monteur hinzufügen",
    href: "/dashboard/mitarbeiter",
  },
  {
    key: "hasBookingLink",
    title: "Buchungslink teilen",
    hint: "Link auf Website oder an Kunden senden",
    href: "/dashboard/einstellungen/betrieb",
  },
];

export function OnboardingChecklist() {
  const { data, isLoading } = useApiSWR<OnboardingStatus>(
    swrKeys.onboardingStatus()
  );
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || !data?.showChecklist || dismissed) return null;

  async function copyBookingLink() {
    if (!data?.bookingUrl) return;
    try {
      await navigator.clipboard.writeText(data.bookingUrl);
      toast.success("Buchungslink kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  }

  return (
    <Card className="relative overflow-hidden border-[#0d5c63]/20 bg-gradient-to-br from-[#0d5c63]/5 to-white !p-5">
      <button
        type="button"
        className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        onClick={() => setDismissed(true)}
        aria-label="Ausblenden"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pr-8">
        <h2 className="text-lg font-bold text-slate-900">
          {data.companyName
            ? `${data.companyName} einrichten`
            : "Betrieb einrichten"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Drei Schritte, dann bist du startklar.
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {CORE_STEPS.map((step) => {
          const done = data.steps[step.key];
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 transition hover:border-[#0d5c63]/30"
              >
                {done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                )}
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-medium ${
                      done ? "text-slate-500 line-through" : "text-slate-900"
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="text-xs text-slate-500">{step.hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {data.bookingUrl && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={copyBookingLink}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Buchungslink kopieren
          </Button>
          <Button type="button" variant="primary" size="sm" className="flex-1" asChild>
            <a href={data.bookingUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Vorschau öffnen
            </a>
          </Button>
        </div>
      )}
    </Card>
  );
}
