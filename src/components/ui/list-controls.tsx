import type { ComponentProps } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const listControlClasses =
  "h-11 min-w-0 rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-[border-color,box-shadow,background-color] hover:border-slate-300 focus:border-[#0d5c63]/35 focus:ring-3 focus:ring-[#0d5c63]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

export function SearchField({
  value,
  onValueChange,
  label,
  placeholder,
  className,
  containerClassName,
  ...props
}: Omit<ComponentProps<"input">, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  containerClassName?: string;
}) {
  return (
    <label className={cn("relative block min-w-0 flex-1", containerClassName)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        {...props}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className={cn(listControlClasses, "w-full pl-10 pr-10 placeholder:text-slate-400", className)}
      />
      {value ? (
        <button
          type="button"
          aria-label={`${label} leeren`}
          onClick={() => onValueChange("")}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d5c63]/25"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </label>
  );
}

export function FilterSelect({
  className,
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(listControlClasses, "w-full px-3.5 pr-10 font-medium sm:w-auto", className)}
    >
      {children}
    </select>
  );
}
