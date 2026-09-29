"use client";

import * as React from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarDays, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const fieldClasses =
  "h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 shadow-sm outline-none transition-[border-color,box-shadow,background-color] focus-visible:border-[#0d5c63]/35 focus-visible:ring-3 focus-visible:ring-[#0d5c63]/10 disabled:opacity-50 appearance-none [&::-webkit-calendar-picker-indicator]:opacity-60";

/**
 * Moderne Datums-/Zeitfelder mit zuverlässigem Mobile-Layout
 * (kein Überlappen von Von/Bis durch native min-width).
 */
export function DateInput({
  className,
  label,
  id,
  type = "date",
  value,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> & {
  label?: React.ReactNode;
  type?: "date" | "time" | "datetime-local" | "month";
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  if (type === "date") {
    return (
      <AppDatePicker
        {...props}
        id={inputId}
        className={className}
        label={label}
        value={value ?? ""}
        onValueChange={onValueChange}
      />
    );
  }

  if (type === "time") {
    return (
      <AppTimePicker
        {...props}
        id={inputId}
        className={className}
        label={label}
        value={value ?? ""}
        onValueChange={onValueChange}
      />
    );
  }

  const inputEl = (
    <input
      id={inputId}
      type={type}
      value={value}
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

function AppTimePicker({
  id,
  className,
  label,
  value,
  onValueChange,
  disabled,
  required,
  name,
  min,
  max,
  step = 900,
  "aria-label": ariaLabel,
}: {
  id: string;
  className?: string;
  label?: React.ReactNode;
  value: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedOptionRef = React.useRef<HTMLButtonElement>(null);
  const secondsStep = Math.max(60, Number(step) || 900);
  const minuteStep = Math.max(1, Math.round(secondsStep / 60));
  const minMinutes = typeof min === "string" && /^\d{2}:\d{2}$/.test(min)
    ? Number(min.slice(0, 2)) * 60 + Number(min.slice(3, 5))
    : 0;
  const maxMinutes = typeof max === "string" && /^\d{2}:\d{2}$/.test(max)
    ? Number(max.slice(0, 2)) * 60 + Number(max.slice(3, 5))
    : 24 * 60 - minuteStep;
  const options = React.useMemo(() => {
    const values: string[] = [];
    for (let minutes = minMinutes; minutes <= maxMinutes; minutes += minuteStep) {
      values.push(formatGridTime(minutes));
    }
    return values;
  }, [maxMinutes, minMinutes, minuteStep]);

  React.useEffect(() => {
    if (open) selectedOptionRef.current?.scrollIntoView({ block: "center" });
  }, [open]);

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel ?? (typeof label === "string" ? label : "Uhrzeit auswählen")}
          className="h-11 w-full min-w-0 justify-start gap-2.5 rounded-2xl border-slate-300 bg-white px-3.5 text-left font-normal shadow-sm hover:border-[#0b6268]/35 hover:bg-white"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[10px] bg-[#0b6268]/8 text-[#0b6268]">
            <Clock3 className="size-4" />
          </span>
          <span className={cn("min-w-0 flex-1 truncate", value ? "text-slate-900" : "text-slate-400")}>
            {value || "Uhrzeit auswählen"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-48 rounded-[20px] border-border/80 bg-white p-2 shadow-[0_24px_65px_rgba(15,23,42,0.18)]"
      >
        <div className="mb-2 flex items-center gap-2 border-b border-slate-100 px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          <Clock3 className="size-3.5" /> Uhrzeit
        </div>
        <div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {options.map((option) => (
            <button
              key={option}
              ref={option === value ? selectedOptionRef : undefined}
              type="button"
              onClick={() => {
                onValueChange?.(option);
                setOpen(false);
              }}
              className={cn(
                "rounded-xl px-2 py-2 text-sm font-medium transition-colors",
                option === value
                  ? "bg-[#0b6268] text-white shadow-sm"
                  : "text-slate-600 hover:bg-[#0b6268]/[0.07] hover:text-[#0b6268]"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </PopoverContent>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
    </Popover>
  );

  if (!label) return <div className={className}>{picker}</div>;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium text-slate-500">
        {label}
      </label>
      {picker}
    </div>
  );
}

function formatGridTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function parseDateValue(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function AppDatePicker({
  id,
  className,
  label,
  value,
  onValueChange,
  disabled,
  required,
  name,
  "aria-label": ariaLabel,
}: {
  id: string;
  className?: string;
  label?: React.ReactNode;
  value: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDateValue(value);

  function selectDate(date: Date | undefined) {
    if (!date) return;
    onValueChange?.(format(date, "yyyy-MM-dd"));
    setOpen(false);
  }

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel ?? (typeof label === "string" ? label : "Datum auswählen")}
          className="h-11 w-full min-w-0 justify-start gap-2.5 rounded-2xl border-slate-300 bg-white px-3.5 text-left font-normal shadow-sm hover:border-[#0b6268]/35 hover:bg-white"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[10px] bg-[#0b6268]/8 text-[#0b6268]">
            <CalendarDays className="size-4" />
          </span>
          <span className={cn("min-w-0 flex-1 truncate", selected ? "text-slate-900" : "text-slate-400")}>
            {selected ? format(selected, "dd.MM.yyyy", { locale: de }) : "Datum auswählen"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-auto rounded-[20px] border-border/80 bg-white p-2 shadow-[0_24px_65px_rgba(15,23,42,0.18)]"
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={selectDate}
          defaultMonth={selected}
          locale={de}
          captionLayout="dropdown"
          className="[--cell-size:--spacing(9)]"
        />
        <div className="flex items-center justify-between border-t border-slate-100 px-2 pb-1 pt-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => selectDate(new Date())}
          >
            Heute
          </Button>
          {value && !required ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-slate-500"
              onClick={() => {
                onValueChange?.("");
                setOpen(false);
              }}
            >
              Löschen
            </Button>
          ) : null}
        </div>
      </PopoverContent>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
    </Popover>
  );

  if (!label) return <div className={className}>{picker}</div>;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium text-slate-500">
        {label}
      </label>
      {picker}
    </div>
  );
}

/** Einheitliche Select-Klassen für Filter (rund, mobil-freundlich). */
export const selectFieldClasses =
  "h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 shadow-sm outline-none transition-[border-color,box-shadow,background-color] hover:border-slate-300 focus-visible:border-[#0d5c63]/35 focus-visible:ring-3 focus-visible:ring-[#0d5c63]/10";
