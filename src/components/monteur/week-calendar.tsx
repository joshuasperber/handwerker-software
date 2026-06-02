"use client";

import { addDays, format, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekDay {
  date: string;
  appointments: {
    id: string;
    startTime: string;
    order: {
      orderNumber: string;
      customer: { firstName: string; lastName: string };
      property: { city: string };
    };
  }[];
}

interface MonteurWeekCalendarProps {
  weekStart: string;
  days: Record<string, WeekDay["appointments"]>;
  selectedDate: string;
  onWeekChange: (weekStart: string) => void;
  onSelectDate: (date: string) => void;
}

export function MonteurWeekCalendar({
  weekStart,
  days,
  selectedDate,
  onWeekChange,
  onSelectDate,
}: MonteurWeekCalendarProps) {
  const start = startOfWeek(new Date(weekStart), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  function shiftWeek(delta: number) {
    onWeekChange(format(addDays(start, delta * 7), "yyyy-MM-dd"));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => shiftWeek(-1)} className="p-2 rounded-lg hover:bg-slate-100">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-semibold text-slate-900">
          KW · {format(start, "d. MMM", { locale: de })} – {format(addDays(start, 6), "d. MMM yyyy", { locale: de })}
        </p>
        <button type="button" onClick={() => shiftWeek(1)} className="p-2 rounded-lg hover:bg-slate-100">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const apts = days[key] ?? [];
          const isSelected = key === selectedDate;
          const isToday = key === format(new Date(), "yyyy-MM-dd");
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className={`rounded-xl p-2 min-h-[88px] text-left border transition-colors ${
                isSelected
                  ? "bg-slate-200 border-slate-300 ring-1 ring-slate-300"
                  : "bg-white border-slate-200 hover:bg-slate-50"
              }`}
            >
              <p className={`text-xs font-medium ${isToday ? "text-[#0d5c63]" : "text-slate-500"}`}>
                {format(day, "EEE", { locale: de })}
              </p>
              <p className={`text-lg font-bold ${isToday ? "text-[#0d5c63]" : "text-slate-800"}`}>
                {format(day, "d")}
              </p>
              {apts.length > 0 && (
                <p className="text-[10px] mt-1 text-[#0d5c63] font-medium">
                  {apts.length} Termin{apts.length !== 1 ? "e" : ""}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        {(days[selectedDate] ?? []).length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Keine Termine an diesem Tag.</p>
        ) : (
          (days[selectedDate] ?? []).map((apt) => (
            <button
              key={apt.id}
              type="button"
              onClick={() => onSelectDate(selectedDate)}
              className="w-full text-left rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            >
              <p className="text-sm font-semibold text-[#0d5c63]">
                {format(new Date(apt.startTime), "HH:mm")} · {apt.order.orderNumber}
              </p>
              <p className="text-sm text-slate-700">
                {apt.order.customer.firstName} {apt.order.customer.lastName}
              </p>
              <p className="text-xs text-slate-500">{apt.order.property.city}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
