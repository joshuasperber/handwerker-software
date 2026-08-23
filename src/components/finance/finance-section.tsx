"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FinanceSection({
  title,
  preview,
  children,
  defaultOpen = false,
  id,
}: {
  title: string;
  preview?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card id={id} className="!p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          {preview && <div className="mt-1 text-sm text-slate-600">{preview}</div>}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-50 lg:hidden"
          aria-expanded={open}
          aria-label={open ? "Details zuklappen" : "Details anzeigen"}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      <div className={cn("mt-3", open ? "block" : "hidden", "lg:block")}>{children}</div>
    </Card>
  );
}
