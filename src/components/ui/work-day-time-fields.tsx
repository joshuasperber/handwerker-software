"use client";

import { useMemo, useState } from "react";
import { format, isToday, parse } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarDays, ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function todayDateValue(d = new Date()) {
  return format(d, "yyyy-MM-dd");
}

export function timeValue(d = new Date()) {
  return format(d, "HH:mm");
}

/** Combine local date + HH:mm into datetime-local / Date-parseable string. */
export function combineDateAndTime(date: string, time: string): string {
  const t = time.length === 5 ? time : time.slice(0, 5);
  return `${date}T${t}`;
}

/**
 * If end is before/equal start on the same calendar day, roll end to next day
 * (supports Nacht-/Überstunden).
 */
export function combineEndDateAndTime(
  date: string,
  startTime: string,
  endTime: string
): string {
  const start = combineDateAndTime(date, startTime);
  let end = combineDateAndTime(date, endTime);
  if (new Date(end).getTime() <= new Date(start).getTime()) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + 1);
    end = combineDateAndTime(todayDateValue(next), endTime);
  }
  return end;
}

export function splitDateTimeLocal(value: string): { date: string; time: string } {
  if (!value) {
    const now = new Date();
    return { date: todayDateValue(now), time: timeValue(now) };
  }
  const [datePart, timePart = "00:00"] = value.split("T");
  return {
    date: datePart || todayDateValue(),
    time: timePart.slice(0, 5) || "00:00",
  };
}

export type WorkDayTimeValue = {
  date: string;
  startTime: string;
  endTime: string;
};

type WorkDayTimeFieldsProps = {
  value: WorkDayTimeValue;
  onChange: (next: WorkDayTimeValue) => void;
  required?: boolean;
  /** Compact labels for inline edit rows */
  compact?: boolean;
  className?: string;
  endOptional?: boolean;
};

function parseLocalDate(date: string): Date {
  return parse(date, "yyyy-MM-dd", new Date());
}

function TimeField({
  label,
  value,
  onChange,
  required,
  compact,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  compact?: boolean;
}) {
  return (
    <label className="group relative block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
        {required ? " *" : ""}
      </span>
      <span
        className={cn(
          "flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 shadow-sm transition-all",
          "focus-within:border-[#0d5c63]/50 focus-within:ring-2 focus-within:ring-[#0d5c63]/15",
          "group-hover:border-slate-300",
          compact ? "h-11" : "h-12"
        )}
      >
        <Clock className="size-4 shrink-0 text-[#0d5c63]/70" aria-hidden />
        <input
          type="time"
          step={300}
          className={cn(
            "w-full min-w-0 border-0 bg-transparent p-0 text-base font-semibold tabular-nums text-slate-900",
            "outline-none focus:ring-0",
            "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0",
            "[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full",
            "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      </span>
    </label>
  );
}

/**
 * Outlook/Teams-ähnliche Zeiteingabe: ein Datum + getrennte Uhrzeiten.
 * Modernes UI mit Calendar-Popover statt nativem Datepicker.
 */
export function WorkDayTimeFields({
  value,
  onChange,
  required,
  compact,
  className,
  endOptional,
}: WorkDayTimeFieldsProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => {
    try {
      return parseLocalDate(value.date);
    } catch {
      return new Date();
    }
  }, [value.date]);

  const dateLabel = format(selected, "EEEE, d. MMMM yyyy", { locale: de });
  const dateShort = format(selected, "dd.MM.yyyy");
  const today = isToday(selected);

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-3 sm:p-3.5",
        className
      )}
    >
      <div>
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Tag
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 text-left shadow-sm transition-all",
                "hover:border-[#0d5c63]/35 hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d5c63]/25",
                "data-[state=open]:border-[#0d5c63]/50 data-[state=open]:ring-2 data-[state=open]:ring-[#0d5c63]/15",
                compact ? "h-12" : "h-14"
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0d5c63]/10 text-[#0d5c63]">
                <CalendarDays className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold capitalize text-slate-900 sm:text-[15px]">
                  {dateLabel}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="tabular-nums">{dateShort}</span>
                  {today ? (
                    <span className="rounded-full bg-[#0d5c63]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#0d5c63]">
                      Heute
                    </span>
                  ) : null}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-slate-400 transition-transform",
                  open && "rotate-180"
                )}
                aria-hidden
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto overflow-hidden rounded-2xl border-slate-200 p-0 shadow-xl"
          >
            <Calendar
              mode="single"
              locale={de}
              selected={selected}
              defaultMonth={selected}
              onSelect={(day) => {
                if (!day) return;
                onChange({ ...value, date: todayDateValue(day) });
                setOpen(false);
              }}
              className="p-3"
            />
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-2">
              <p className="text-[11px] text-slate-500">Beliebigen Tag wählen</p>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                  onChange({ ...value, date: todayDateValue() });
                  setOpen(false);
                }}
              >
                Heute
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {/* Native fallback for form required / accessibility without showing UI */}
        <input type="hidden" value={value.date} required={required} readOnly />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <TimeField
          label="Beginn"
          value={value.startTime}
          onChange={(startTime) => onChange({ ...value, startTime })}
          required={required}
          compact={compact}
        />
        <TimeField
          label="Ende"
          value={value.endTime}
          onChange={(endTime) => onChange({ ...value, endTime })}
          required={required && !endOptional}
          compact={compact}
        />
      </div>
    </div>
  );
}

export function defaultWorkDayTimes(now = new Date()): WorkDayTimeValue {
  const end = new Date(now);
  end.setHours(end.getHours() + 1);
  return {
    date: todayDateValue(now),
    startTime: timeValue(now),
    endTime: timeValue(end),
  };
}
