/** Markenfarben-Palette für die Dashboard-Charts. */
export const CHART_COLORS = [
  "#0d5c63", // Teal (Primär)
  "#e87722", // Orange (Aktion)
  "#2563eb", // Blau
  "#16a34a", // Grün
  "#9333ea", // Violett
  "#dc2626", // Rot
  "#0891b2", // Cyan
  "#ca8a04", // Gelb
  "#64748b", // Slate
];

export function pickColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
