"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  itemClassName,
  title,
  size = "default",
  fullWidth = false,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  ariaLabel: string;
  className?: string;
  itemClassName?: string;
  title?: string;
  size?: "sm" | "default";
  fullWidth?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "inline-flex min-w-0 items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 shadow-inner",
        fullWidth && "flex w-full",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative min-w-0 rounded-xl border border-transparent font-semibold whitespace-nowrap outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:ring-3 focus-visible:ring-[#0b6268]/15 active:scale-[.98] disabled:pointer-events-none disabled:opacity-40",
              size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
              fullWidth && "flex-1",
              active
                ? "border-white/80 bg-white text-slate-950 shadow-[0_2px_10px_rgba(15,23,42,0.1)]"
                : "text-slate-500 hover:bg-white/55 hover:text-slate-800",
              itemClassName
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
