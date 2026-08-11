"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AddressSuggestion } from "@/lib/addresses/suggest";
import { Loader2, MapPin } from "lucide-react";

type StreetAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  hint?: string;
};

export function StreetAutocomplete({
  value,
  onChange,
  onSelect,
  label = "Straße",
  placeholder = "z. B. Hauptstraße 12",
  required = false,
  disabled = false,
  className,
  hint,
}: StreetAutocompleteProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState("");
  const skipNextFetch = useRef(false);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const q = value.trim();
    if (disabled || q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/address/suggest?q=${encodeURIComponent(q)}&limit=8`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setSuggestions([]);
          setError(data.error ?? "Adresssuche nicht verfügbar");
          setOpen(Boolean(data.error));
          return;
        }
        const list = (data.data?.suggestions ?? []) as AddressSuggestion[];
        setSuggestions(list);
        setOpen(list.length > 0);
        setActiveIndex(list.length ? 0 : -1);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setSuggestions([]);
        setError("Adresssuche fehlgeschlagen");
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, disabled]);

  function applySuggestion(s: AddressSuggestion) {
    skipNextFetch.current = true;
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(s);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      applySuggestion(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className={cn("relative", className)} ref={wrapRef}>
      <Input
        label={label}
        value={value}
        disabled={disabled}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin text-slate-400" />
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((s, idx) => (
            <li key={s.id} role="option" aria-selected={idx === activeIndex}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left text-sm",
                  idx === activeIndex ? "bg-[#0d5c63]/10 text-[#0d5c63]" : "hover:bg-slate-50"
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => applySuggestion(s)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>
                  <span className="block font-medium">{s.streetLine || s.label}</span>
                  <span className="text-xs text-slate-500">
                    {[s.zipCode, s.city].filter(Boolean).join(" ")}
                    {s.countryCode && s.countryCode !== "de"
                      ? ` · ${s.countryCode.toUpperCase()}`
                      : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-amber-700">{error}</p>}
    </div>
  );
}
