"use client";

import { cn } from "@/lib/utils";
import type { AmountMode } from "@/lib/amount-mode";
import { SegmentedControl } from "@/components/ui/segmented-control";

export function AmountModeToggle({
  mode,
  onChange,
  className,
}: {
  mode: AmountMode;
  onChange: (mode: AmountMode) => void;
  className?: string;
}) {
  return (
    <SegmentedControl
      value={mode}
      onValueChange={onChange}
      ariaLabel="Anzeige Brutto oder Netto — ändert keine gespeicherten Daten"
      title="Nur Anzeigeoption — gespeicherte Beträge bleiben unverändert"
      size="sm"
      className={cn(className)}
      options={[
        { value: "gross", label: "Brutto" },
        { value: "net", label: "Netto" },
      ]}
    />
  );
}
