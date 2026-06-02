/** Entfernungsschätzung – vorbereitet für externe Routing-API */

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Straßenentfernung ≈ Luftlinie × Faktor (bis Routing-API angebunden ist) */
export function estimateRoadDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  roadFactor = 1.25
): number {
  return Math.round(haversineKm(lat1, lon1, lat2, lon2) * roadFactor * 10) / 10;
}

export function estimateDriveTimeHours(distanceKm: number, avgSpeedKmh = 50): number {
  return Math.round((distanceKm / avgSpeedKmh) * 100) / 100;
}

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lon: number } | null> {
  const token = process.env.MAPBOX_TOKEN ?? process.env.OPENROUTESERVICE_API_KEY;
  if (!token) return null;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1&country=de`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const [lon, lat] = data.features?.[0]?.center ?? [];
    if (lat == null || lon == null) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}
