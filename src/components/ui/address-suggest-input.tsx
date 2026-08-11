"use client";

/**
 * Einzeiliges Adressfeld mit Vorschlägen (z. B. Termin-Freitextadresse).
 */

import { StreetAutocomplete } from "@/components/ui/street-autocomplete";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function AddressSuggestInput({
  value,
  onChange,
  label = "Adresse",
  placeholder = "Straße, PLZ Ort…",
  disabled,
  className,
}: Props) {
  return (
    <StreetAutocomplete
      className={className}
      label={label}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      hint="Vorschlag wählen oder Adresse frei tippen."
      onChange={onChange}
      onSelect={(s) => {
        const line = [s.streetLine, [s.zipCode, s.city].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(", ");
        onChange(line);
      }}
    />
  );
}
