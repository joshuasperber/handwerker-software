"use client";

import { Input } from "@/components/ui/input";
import { StreetAutocomplete } from "@/components/ui/street-autocomplete";
import { cn } from "@/lib/utils";
import type { AddressSuggestion } from "@/lib/addresses/suggest";

export type AddressValue = {
  street: string;
  zipCode: string;
  city: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string;
};

type AddressFieldsProps = {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  onSelectSuggestion?: (suggestion: AddressSuggestion) => void;
  streetLabel?: string;
  zipLabel?: string;
  cityLabel?: string;
  notesLabel?: string;
  showNotes?: boolean;
  required?: boolean;
  className?: string;
  streetClassName?: string;
  disabled?: boolean;
  hint?: string;
};

export function AddressFields({
  value,
  onChange,
  onSelectSuggestion,
  streetLabel = "Straße",
  zipLabel = "PLZ",
  cityLabel = "Ort",
  notesLabel = "Adressnotiz",
  showNotes = false,
  required = false,
  className,
  streetClassName = "sm:col-span-2",
  disabled = false,
  hint = "Vorschlag wählen – PLZ und Ort werden übernommen. Manuelle Eingabe bleibt möglich.",
}: AddressFieldsProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <StreetAutocomplete
        className={streetClassName}
        label={streetLabel}
        value={value.street}
        required={required}
        disabled={disabled}
        hint={hint}
        onChange={(street) =>
          onChange({
            ...value,
            street,
            latitude: null,
            longitude: null,
          })
        }
        onSelect={(s) => {
          onChange({
            ...value,
            street: s.streetLine,
            zipCode: s.zipCode || value.zipCode,
            city: s.city || value.city,
            country: s.country || value.country || "Deutschland",
            latitude: s.latitude,
            longitude: s.longitude,
          });
          onSelectSuggestion?.(s);
        }}
      />

      <Input
        label={zipLabel}
        value={value.zipCode}
        disabled={disabled}
        required={required}
        inputMode="numeric"
        autoComplete="postal-code"
        onChange={(e) => onChange({ ...value, zipCode: e.target.value })}
      />
      <Input
        label={cityLabel}
        value={value.city}
        disabled={disabled}
        required={required}
        autoComplete="address-level2"
        onChange={(e) => onChange({ ...value, city: e.target.value })}
      />

      {showNotes && (
        <Input
          label={notesLabel}
          className="sm:col-span-2"
          value={value.notes ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="z. B. Hinterhof, 2. Einfahrt"
        />
      )}
    </div>
  );
}
