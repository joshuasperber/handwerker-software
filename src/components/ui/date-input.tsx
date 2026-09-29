"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarDays, ChevronDown, Clock3 } from "lucide-react";
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

const MOBILE_TIME_QUERY = "(max-width: 767px), (pointer: coarse)";

function subscribeToMobileTimePicker(callback: () => void) {
  const media = window.matchMedia(MOBILE_TIME_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getMobileTimePickerSnapshot() {
  return window.matchMedia(MOBILE_TIME_QUERY).matches;
}

function getServerTimePickerSnapshot() {
  return false;
}

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
  const useNativeMobilePicker = React.useSyncExternalStore(
    subscribeToMobileTimePicker,
    getMobileTimePickerSnapshot,
    getServerTimePickerSnapshot
  );
  const [inputState, setInputState] = React.useState({
    sourceValue: value,
    draft: value,
    invalid: false,
  });
  const draft = inputState.sourceValue === value ? inputState.draft : value;
  const invalid = inputState.sourceValue === value ? inputState.invalid : false;
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

  if (useNativeMobilePicker) {
    const nativePicker = (
      <div className="flex h-12 w-full min-w-0 items-center rounded-2xl border border-slate-300 bg-white px-3 shadow-sm transition-[border-color,box-shadow] focus-within:border-[#0b6268]/35 focus-within:ring-3 focus-within:ring-[#0b6268]/10">
        <Clock3 className="size-4 shrink-0 text-[#0b6268]" aria-hidden="true" />
        <input
          id={id}
          type="time"
          value={value}
          disabled={disabled}
          required={required}
          name={name}
          min={min}
          max={max}
          step={step}
          aria-label={ariaLabel ?? (typeof label === "string" ? label : "Uhrzeit auswählen")}
          onChange={(event) => onValueChange?.(event.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-base font-semibold tabular-nums text-slate-900 outline-none [color-scheme:light]"
        />
      </div>
    );

    if (!label) return <div className={className}>{nativePicker}</div>;

    return (
      <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
        <label htmlFor={id} className="text-xs font-medium text-slate-500">
          {label}
        </label>
        {nativePicker}
      </div>
    );
  }

  function commitTime(nextValue: string): boolean {
    const normalized = normalizeTimeInput(nextValue);
    if (!normalized) {
      setInputState({ sourceValue: value, draft: nextValue, invalid: true });
      return false;
    }
    const minutes = parseTimeMinutes(normalized);
    if (minutes < minMinutes || minutes > maxMinutes) {
      setInputState({ sourceValue: value, draft: nextValue, invalid: true });
      return false;
    }
    setInputState({ sourceValue: value, draft: normalized, invalid: false });
    onValueChange?.(normalized);
    return true;
  }

  function selectTime(nextValue: string) {
    if (!commitTime(nextValue)) return;
    setOpen(false);
  }

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "flex h-11 w-full min-w-0 items-center rounded-2xl border bg-white pl-3 shadow-sm transition-[border-color,box-shadow] focus-within:ring-3",
          invalid
            ? "border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-100"
            : "border-slate-300 hover:border-[#0b6268]/35 focus-within:border-[#0b6268]/35 focus-within:ring-[#0b6268]/10",
          disabled && "opacity-50"
        )}
      >
        <Clock3 className="size-4 shrink-0 text-[#0b6268]" aria-hidden="true" />
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          required={required}
          value={draft}
          placeholder="hh:mm"
          aria-label={ariaLabel ?? (typeof label === "string" ? label : "Uhrzeit eingeben")}
          aria-invalid={invalid}
          pattern="(?:[01]?\d|2[0-3]):[0-5]\d"
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm font-medium tabular-nums text-slate-900 outline-none placeholder:text-slate-400"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const nextValue = sanitizeTimeInput(event.target.value);
            setInputState({ sourceValue: value, draft: nextValue, invalid: false });
            if (isCompleteTime(nextValue)) commitTime(nextValue);
          }}
          onBlur={() => {
            if (!draft && !required) {
              setInputState({ sourceValue: value, draft: "", invalid: false });
              onValueChange?.("");
              return;
            }
            commitTime(draft);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && commitTime(draft)) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Zeitvorschläge öffnen"
            className="mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-[#0b6268] transition-colors hover:bg-[#0b6268]/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b6268]/20"
          >
            <ChevronDown aria-hidden="true" className="size-4" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="flex max-h-[min(20rem,var(--radix-popover-content-available-height))] w-52 flex-col overflow-hidden rounded-[20px] border-border/80 bg-white p-2 shadow-[0_24px_65px_rgba(15,23,42,0.18)]"
      >
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-2 pb-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Clock3 className="size-3.5" /> Vorschläge
          </span>
          <span className="text-[10px] font-medium text-slate-400">oder eintippen</span>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] touch-pan-y">
          {options.map((option) => (
            <button
              key={option}
              ref={option === value ? selectedOptionRef : undefined}
              type="button"
              onClick={() => selectTime(option)}
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

function parseTimeMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isCompleteTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function sanitizeTimeInput(value: string): string {
  const cleaned = value.replace(/[^\d:]/g, "").slice(0, 5);
  if (cleaned.includes(":")) return cleaned;
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`;
}

export function normalizeTimeInput(value: string): string | null {
  const trimmed = value.trim();
  const compact = trimmed.replace(/\D/g, "");
  const candidate = trimmed.includes(":")
    ? trimmed
    : compact.length === 3
      ? `${compact.slice(0, 1)}:${compact.slice(1)}`
      : compact.length === 4
        ? `${compact.slice(0, 2)}:${compact.slice(2)}`
        : trimmed;
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(candidate);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
        <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-1 pb-1 pt-2">
          {[
            { label: "Heute", date: new Date() },
            { label: "Morgen", date: addDays(new Date(), 1) },
            { label: "+1 Woche", date: addDays(new Date(), 7) },
          ].map((shortcut) => (
            <Button
              key={shortcut.label}
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => selectDate(shortcut.date)}
              className="rounded-full px-2.5 text-[#0b6268]"
            >
              {shortcut.label}
            </Button>
          ))}
          {value && !required ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="ml-auto rounded-full text-slate-500"
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
  "h-11 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3.5 pr-10 text-sm font-medium text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-[border-color,box-shadow,background-color] hover:border-slate-300 focus-visible:border-[#0d5c63]/35 focus-visible:ring-3 focus-visible:ring-[#0d5c63]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70";
