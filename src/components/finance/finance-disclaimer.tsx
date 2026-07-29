"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FINANCE_DISCLAIMERS } from "@/lib/finance/types";
import { Info } from "lucide-react";

export function FinanceDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <Alert className="border-slate-200 bg-slate-50/80">
      <Info className="text-[#0d5c63]" />
      <AlertDescription className="text-slate-600">
        {compact ? FINANCE_DISCLAIMERS.estimatesOnly : FINANCE_DISCLAIMERS.overview}
      </AlertDescription>
    </Alert>
  );
}
