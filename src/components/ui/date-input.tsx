"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const fieldClasses =
  "h-11 w-full min-w-0 max-w-full rounded-2xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800 shadow-sm outline-none transition-colors focus-visible:border-[#0d5c63] focus-visible:ring-2 focus-visible:ring-[#0d5c63]/25 disabled:opacity-50 appearance-none [&::-webkit-calendar-picker-indicator]:opacity-60";

/**
 * Moderne Datums-/Zeitfelder mit zuverlässigem Mobile-Layout
 * (kein Überlappen von Von/Bis durch native min-width).
 */
export function DateInput({
  className,
  label,
  id,
  type = "date",
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  label?: React.ReactNode;
  type?: "date" | "time" | "datetime-local" | "month";
}) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  const inputEl = (
    <input
      id={inputId}
      type={type}
      data-slot="date-input"
      className={cn(fieldClasses, !label && className)}
      {...props}
    />
  );

  if (!label) return inputEl;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={inputId} className="text-xs font-medium text-slate-500">
        {label}
      </label>
      {inputEl}
    </div>
  );
}

/** Einheitliche Select-Klassen für Filter (rund, mobil-freundlich). */
export const selectFieldClasses =
  "h-11 w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800 shadow-sm outline-none focus-visible:border-[#0d5c63] focus-visible:ring-2 focus-visible:ring-[#0d5c63]/25";
