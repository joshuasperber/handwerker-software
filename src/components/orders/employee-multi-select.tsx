"use client";

import { useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type EmployeeMultiOption = {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  disabled?: boolean;
  disabledReason?: string;
};

interface EmployeeMultiSelectProps {
  employees: EmployeeMultiOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  /** Kompakte Höhe für Mobile */
  maxListHeightClass?: string;
}

export function EmployeeMultiSelect({
  employees,
  value,
  onChange,
  label = "Mitarbeiter",
  placeholder = "Mitarbeiter suchen…",
  className,
  maxListHeightClass = "max-h-48",
}: EmployeeMultiSelectProps) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const name = `${e.firstName} ${e.lastName}`.toLowerCase();
      return name.includes(q) || (e.role ?? "").toLowerCase().includes(q);
    });
  }, [employees, query]);

  const selectedEmployees = employees.filter((e) => selected.has(e.id));

  function toggle(id: string) {
    if (selected.has(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}

      {selectedEmployees.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEmployees.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => toggle(e.id)}
              className="inline-flex items-center gap-1 rounded-full bg-[#0d5c63]/10 px-2.5 py-1 text-xs font-medium text-[#0d5c63]"
            >
              {e.firstName} {e.lastName}
              <X className="h-3 w-3 opacity-70" />
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      <div
        className={cn(
          "overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-50",
          maxListHeightClass
        )}
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-slate-400">Keine Treffer</p>
        ) : (
          filtered.map((e) => {
            const checked = selected.has(e.id);
            return (
              <label
                key={e.id}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50",
                  e.disabled && "cursor-not-allowed opacity-40"
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={checked}
                  disabled={e.disabled}
                  onChange={() => !e.disabled && toggle(e.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800">
                    {e.firstName} {e.lastName}
                  </span>
                  {e.role && (
                    <span className="ml-1.5 text-xs text-slate-400">{e.role}</span>
                  )}
                  {e.disabledReason && (
                    <span
                      className={cn(
                        "ml-1.5 text-xs",
                        e.disabled ? "text-amber-600" : "text-slate-400"
                      )}
                    >
                      {e.disabledReason}
                    </span>
                  )}
                </span>
              </label>
            );
          })
        )}
      </div>
      <p className="text-xs text-slate-400">
        {value.length === 0
          ? "Noch niemand zugewiesen"
          : `${value.length} Mitarbeiter ausgewählt`}
      </p>
    </div>
  );
}
