"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoButton } from "@/components/ui/info-button";
import { FINANCE_DISCLAIMERS } from "@/lib/finance/types";
import { Info } from "lucide-react";

export function FinanceDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <Alert className="border-slate-200 bg-slate-50/80">
      <Info className="text-[#0d5c63]" />
      <AlertDescription className="text-slate-600">
        {compact ? FINANCE_DISCLAIMERS.estimatesOnly : FINANCE_DISCLAIMERS.overview}{" "}
        <InfoButton title="Rechtlicher Hinweis" ariaLabel="Rechtlicher Hinweis">
          <p>{FINANCE_DISCLAIMERS.overview}</p>
          <p>{FINANCE_DISCLAIMERS.taxEstimate}</p>
          <p>{FINANCE_DISCLAIMERS.advisor}</p>
          <p>{FINANCE_DISCLAIMERS.investment}</p>
          <p className="text-xs text-slate-500 mt-2">
            Die App gibt keine verbindlichen Steuerempfehlungen und trifft keine
            automatischen steuerlichen Entscheidungen.
          </p>
        </InfoButton>
      </AlertDescription>
    </Alert>
  );
}
