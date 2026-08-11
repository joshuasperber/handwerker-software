/**
 * Adressvorschläge für Autocomplete.
 * Primär: Photon (Komoot/OSM) – kostenlos, gut für DE/AT/CH, kein API-Key nötig.
 * Optional: Mapbox, wenn MAPBOX_TOKEN gesetzt ist (höhere Qualität/Limits).
 */

export type AddressSuggestion = {
  id: string;
  /** Anzeige in der Liste, inkl. PLZ/Ort zur Unterscheidung mehrdeutiger Straßen */
  label: string;
  street: string;
  houseNumber: string | null;
  /** Straße inkl. Hausnummer (App speichert Straße meist als ein Feld) */
  streetLine: string;
  zipCode: string;
  city: string;
  country: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  provider: "photon" | "mapbox";
};

export type AddressSuggestResult = {
  suggestions: AddressSuggestion[];
  provider: "photon" | "mapbox" | "none";
  error?: string;
};

const DEFAULT_COUNTRIES = ["de", "at", "ch"];

function buildStreetLine(street: string, houseNumber: string | null): string {
  const s = street.trim();
  const h = houseNumber?.trim();
  if (!s) return h ?? "";
  if (!h) return s;
  return `${s} ${h}`;
}

function formatLabel(parts: {
  streetLine: string;
  zipCode: string;
  city: string;
  country?: string;
}): string {
  const line1 = parts.streetLine || "Adresse";
  const line2 = [parts.zipCode, parts.city].filter(Boolean).join(" ");
  if (line2) return `${line1}, ${line2}`;
  return line1;
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string;
  };
};

async function suggestViaPhoton(
  query: string,
  countries: string[],
  limit: number
): Promise<AddressSuggestion[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("lang", "de");
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 12)));
  // Bias Mitteleuropa
  url.searchParams.set("lat", "51.16");
  url.searchParams.set("lon", "10.45");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "JoMaster-Handwerker/1.0 (address-autocomplete)",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Photon antwortete mit ${res.status}`);

  const data = (await res.json()) as { features?: PhotonFeature[] };
  const allowed = new Set(countries.map((c) => c.toLowerCase()));
  const out: AddressSuggestion[] = [];

  for (const f of data.features ?? []) {
    const p = f.properties ?? {};
    const cc = (p.countrycode ?? "").toLowerCase();
    if (allowed.size && cc && !allowed.has(cc)) continue;

    const city =
      p.city?.trim() ||
      p.town?.trim() ||
      p.village?.trim() ||
      p.municipality?.trim() ||
      p.district?.trim() ||
      "";
    const street =
      p.street?.trim() ||
      (p.type === "street" || p.type === "house" ? p.name?.trim() : "") ||
      p.name?.trim() ||
      "";
    const houseNumber = p.housenumber?.trim() || null;
    const zipCode = p.postcode?.trim() || "";
    if (!street && !city && !zipCode) continue;

    const streetLine = buildStreetLine(street || p.name || "", houseNumber);
    const [lon, lat] = f.geometry?.coordinates ?? [];
    const id = `photon:${p.osm_type ?? "x"}:${p.osm_id ?? `${streetLine}-${zipCode}-${city}`}`;

    out.push({
      id,
      label: formatLabel({
        streetLine,
        zipCode,
        city,
        country: p.country,
      }),
      street: street || streetLine,
      houseNumber,
      streetLine,
      zipCode,
      city,
      country: p.country?.trim() || "Deutschland",
      countryCode: cc || "de",
      latitude: typeof lat === "number" ? lat : null,
      longitude: typeof lon === "number" ? lon : null,
      provider: "photon",
    });

    if (out.length >= limit) break;
  }

  return dedupeSuggestions(out);
}

type MapboxFeature = {
  id?: string;
  place_name?: string;
  text?: string;
  address?: string;
  center?: [number, number];
  context?: Array<{ id?: string; text?: string; short_code?: string }>;
  properties?: { address?: string };
};

async function suggestViaMapbox(
  query: string,
  countries: string[],
  limit: number,
  token: string
): Promise<AddressSuggestion[]> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("language", "de");
  url.searchParams.set("types", "address,place");
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 10)));
  url.searchParams.set("country", countries.join(","));

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Mapbox antwortete mit ${res.status}`);

  const data = (await res.json()) as { features?: MapboxFeature[] };
  const out: AddressSuggestion[] = [];

  for (const f of data.features ?? []) {
    const ctx = f.context ?? [];
    const postcode = ctx.find((c) => c.id?.startsWith("postcode."))?.text?.trim() || "";
    const place =
      ctx.find((c) => c.id?.startsWith("place."))?.text?.trim() ||
      ctx.find((c) => c.id?.startsWith("locality."))?.text?.trim() ||
      "";
    const countryCtx = ctx.find((c) => c.id?.startsWith("country."));
    const countryCode = (countryCtx?.short_code ?? "de").toLowerCase().replace("de-", "");
    const houseNumber = (f.address || f.properties?.address || "").trim() || null;
    const street = (f.text || "").trim();
    const streetLine = buildStreetLine(street, houseNumber);
    const [lon, lat] = f.center ?? [];

    out.push({
      id: `mapbox:${f.id ?? streetLine}`,
      label:
        f.place_name?.trim() ||
        formatLabel({ streetLine, zipCode: postcode, city: place }),
      street: street || streetLine,
      houseNumber,
      streetLine,
      zipCode: postcode,
      city: place,
      country: countryCtx?.text?.trim() || "Deutschland",
      countryCode,
      latitude: typeof lat === "number" ? lat : null,
      longitude: typeof lon === "number" ? lon : null,
      provider: "mapbox",
    });
  }

  return dedupeSuggestions(out).slice(0, limit);
}

function dedupeSuggestions(items: AddressSuggestion[]): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const item of items) {
    const key = `${item.streetLine}|${item.zipCode}|${item.city}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function suggestAddresses(input: {
  query: string;
  limit?: number;
  countries?: string[];
}): Promise<AddressSuggestResult> {
  const query = input.query.trim();
  if (query.length < 3) {
    return { suggestions: [], provider: "none" };
  }

  const limit = input.limit ?? 8;
  const countries = (input.countries?.length ? input.countries : DEFAULT_COUNTRIES).map((c) =>
    c.toLowerCase()
  );

  const mapboxToken = process.env.MAPBOX_TOKEN?.trim();
  if (mapboxToken) {
    try {
      const suggestions = await suggestViaMapbox(query, countries, limit, mapboxToken);
      if (suggestions.length) {
        return { suggestions, provider: "mapbox" };
      }
    } catch {
      // Fallback auf Photon
    }
  }

  try {
    const suggestions = await suggestViaPhoton(query, countries, limit);
    return { suggestions, provider: "photon" };
  } catch (err) {
    return {
      suggestions: [],
      provider: "none",
      error: err instanceof Error ? err.message : "Adresssuche fehlgeschlagen",
    };
  }
}
