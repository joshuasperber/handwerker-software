/** Vordefinierte Termin-Farben für die Kalender-UI. */
export const APPOINTMENT_COLORS = [
  { id: "blue", hex: "#2563eb", label: "Blau · Aufmaß" },
  { id: "green", hex: "#16a34a", label: "Grün · Montage" },
  { id: "orange", hex: "#ea580c", label: "Orange · Fahrt / Vorbereitung" },
  { id: "red", hex: "#dc2626", label: "Rot · Wichtig / Problem" },
  { id: "gray", hex: "#64748b", label: "Grau · Intern" },
  { id: "teal", hex: "#0d5c63", label: "Petrol · Standard" },
  { id: "violet", hex: "#7c3aed", label: "Violett" },
  { id: "amber", hex: "#d97706", label: "Amber" },
] as const;

export type AppointmentColorId = (typeof APPOINTMENT_COLORS)[number]["id"];

export function resolveAppointmentColor(input: {
  color?: string | null;
  employeeColor?: string | null;
}): string {
  if (input.color?.trim()) return input.color.trim();
  if (input.employeeColor?.trim()) return input.employeeColor.trim();
  return "#0d5c63";
}

export function appointmentDisplayTitle(input: {
  title?: string | null;
  order?: { title?: string | null; orderNumber?: string | null } | null;
}): string {
  if (input.title?.trim()) return input.title.trim();
  if (input.order?.title?.trim()) return input.order.title.trim();
  if (input.order?.orderNumber) return input.order.orderNumber;
  return "Termin";
}
