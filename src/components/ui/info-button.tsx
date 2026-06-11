"use client";

import * as React from "react";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface InfoButtonProps {
  /** Überschrift im Popover (optional). */
  title?: React.ReactNode;
  /** Inhalt – Text oder beliebige React-Knoten. */
  children: React.ReactNode;
  /** Barrierefreies Label des Auslöser-Buttons. */
  ariaLabel?: string;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Kompakter „i“-Button, der erklärenden Text erst auf Klick als Popover zeigt.
 * So bleiben komplexe Seiten (Kalkulation, Amortisierung, Einkauf) aufgeräumt.
 */
export function InfoButton({
  title,
  children,
  ariaLabel = "Mehr Informationen",
  className,
  align = "end",
  side = "bottom",
}: InfoButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#0d5c63] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d5c63]/40",
            className
          )}
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-80 max-w-[90vw]">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        <div className="text-sm leading-relaxed text-muted-foreground [&_p+p]:mt-2">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
