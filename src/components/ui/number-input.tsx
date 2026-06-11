"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const inputClasses =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none tabular-nums placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

/**
 * Wandelt eine Roh-Eingabe in einen sauberen Zahlen-String:
 *  - akzeptiert Komma oder Punkt als Dezimaltrennzeichen
 *  - entfernt führende Nullen (aus „020“ wird „20“, „0“ bleibt „0“, „0,5“ bleibt erhalten)
 *  - lässt ein optionales Minus zu, wenn negative Werte erlaubt sind
 */
function sanitize(raw: string, allowDecimal: boolean, allowNegative: boolean): string {
  let s = raw.replace(/\s/g, "");
  if (!allowDecimal) s = s.replace(/[.,]/g, "");

  const negative = allowNegative && s.startsWith("-");
  s = s.replace(/-/g, "");

  // Nur Ziffern und ein einziges Dezimaltrennzeichen behalten.
  s = s.replace(/[^0-9.,]/g, "");
  const firstSep = s.search(/[.,]/);
  if (firstSep !== -1) {
    const intPart = s.slice(0, firstSep);
    const decPart = s.slice(firstSep + 1).replace(/[.,]/g, "");
    s = `${intPart},${decPart}`;
  }

  // Führende Nullen entfernen – außer eine einzelne 0 vor dem Komma („0,5“).
  s = s.replace(/^0+(?=\d)/, "");
  if (s.startsWith(",")) s = `0${s}`;

  return negative ? `-${s}` : s;
}

/** „12,5“ / „12.5“ → 12.5 ; leer → null */
function toNumber(display: string): number | null {
  if (display === "" || display === "-" || display === ",") return null;
  const n = Number(display.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Zahl → Anzeige-String (Komma als Dezimaltrennzeichen). */
function toDisplay(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return String(value).replace(".", ",");
}

export interface NumberInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "min" | "max"> {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  label?: React.ReactNode;
  /** Externe Fehlermeldung; überschreibt die interne Pflichtfeld-Meldung. */
  error?: string;
  /** Dezimalstellen erlauben (Standard: true). Bei false sind nur Ganzzahlen möglich. */
  allowDecimal?: boolean;
  allowNegative?: boolean;
  min?: number;
  max?: number;
  /** Einheit/Suffix rechts im Feld, z. B. „€“ oder „h“. */
  suffix?: React.ReactNode;
}

/**
 * Zahlen-Eingabefeld mit robustem Verhalten:
 *  - Bei Fokus wird der Inhalt markiert, sodass eine vorhandene „0“ direkt ersetzt wird.
 *  - Führende Nullen werden entfernt (kein „020“ mehr).
 *  - Pflichtfelder (`required`) zeigen bei leerer Eingabe eine Fehlermeldung.
 */
export function NumberInput({
  value,
  onValueChange,
  label,
  error,
  allowDecimal = true,
  allowNegative = false,
  required,
  min,
  max,
  suffix,
  id,
  className,
  onFocus,
  onBlur,
  disabled,
  placeholder,
  ...rest
}: NumberInputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const [text, setText] = React.useState<string>(toDisplay(value));
  const [touched, setTouched] = React.useState(false);
  const focusedRef = React.useRef(false);

  // Externe Wertänderungen übernehmen, solange der Nutzer das Feld nicht bearbeitet.
  React.useEffect(() => {
    if (focusedRef.current) return;
    setText(toDisplay(value));
  }, [value]);

  const requiredError =
    required && touched && toNumber(text) == null ? "Pflichtfeld – bitte eine Zahl eingeben." : undefined;
  const shownError = error ?? requiredError;

  function clamp(n: number): number {
    let v = n;
    if (min != null && v < min) v = min;
    if (max != null && v > max) v = max;
    return v;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = sanitize(e.target.value, allowDecimal, allowNegative);
    setText(next);
    const parsed = toNumber(next);
    onValueChange(parsed);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    focusedRef.current = false;
    setTouched(true);
    const parsed = toNumber(text);
    if (parsed != null) {
      const clamped = clamp(parsed);
      setText(toDisplay(clamped));
      if (clamped !== parsed) onValueChange(clamped);
    }
    onBlur?.(e);
  }

  const inputEl = (
    <div className="relative">
      <input
        id={inputId}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        data-slot="number-input"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={shownError ? true : undefined}
        className={cn(inputClasses, suffix ? "pr-8" : undefined, label || shownError ? undefined : className)}
        onFocus={(e) => {
          focusedRef.current = true;
          e.target.select();
          onFocus?.(e);
        }}
        onChange={handleChange}
        onBlur={handleBlur}
        {...rest}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );

  if (!label && !shownError) return inputEl;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
      )}
      {inputEl}
      {shownError && <p className="text-xs text-destructive">{shownError}</p>}
    </div>
  );
}
