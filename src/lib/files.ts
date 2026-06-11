import type { FileCategory } from "@/generated/prisma/client";

/** Maximale Dateigröße pro Upload (nach Komprimierung), serverseitig erzwungen. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

/** Erlaubte MIME-Typen für Foto-/Datei-Uploads. */
export const ALLOWED_UPLOAD_MIME_PREFIXES = ["image/"] as const;
export const ALLOWED_UPLOAD_MIME_TYPES = ["application/pdf"] as const;

/**
 * Foto-Kategorien, die in der Foto-/Datei-Funktion auswählbar sind.
 * PLAN/GRUNDRISS sind bewusst ausgeschlossen – diese werden im Plan-Viewer verwaltet.
 */
export const PHOTO_CATEGORIES: { value: FileCategory; label: string }[] = [
  { value: "AUFMASS", label: "Aufmaß" },
  { value: "BAUSTELLE", label: "Baustelle" },
  { value: "WOHNUNG", label: "Wohnung" },
  { value: "BESONDERHEITEN", label: "Besonderheiten" },
  { value: "SCHAEDEN", label: "Schäden" },
  { value: "VORHER", label: "Vorher" },
  { value: "NACHHER", label: "Nachher" },
  { value: "MONTAGE", label: "Montage" },
  { value: "BESONDERE_SITUATION", label: "Besondere Situation" },
  { value: "KUNDENFOTO", label: "Kundenfoto" },
  { value: "DOKUMENT", label: "Dokument" },
  { value: "ABSCHLUSS", label: "Abschluss" },
];

/** Kategorien, die nicht in der Foto-Galerie angezeigt werden (separater Plan-Viewer). */
export const NON_PHOTO_CATEGORIES: FileCategory[] = ["PLAN", "GRUNDRISS"];

const CATEGORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(PHOTO_CATEGORIES.map((c) => [c.value, c.label])),
  PLAN: "Plan",
  GRUNDRISS: "Grundriss",
};

export function fileCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function isValidPhotoCategory(value: string): value is FileCategory {
  return PHOTO_CATEGORIES.some((c) => c.value === value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** Serverseitige Validierung von Größe und Typ einer hochgeladenen Datei. */
export function validateUpload(mimeType: string, sizeBytes: number): UploadValidationResult {
  const typeAllowed =
    ALLOWED_UPLOAD_MIME_PREFIXES.some((p) => mimeType.startsWith(p)) ||
    (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mimeType);

  if (!typeAllowed) {
    return {
      ok: false,
      error: "Dateityp nicht erlaubt. Bitte ein Bild (JPG, PNG, …) oder PDF hochladen.",
    };
  }

  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `Datei zu groß (${formatBytes(sizeBytes)}). Maximal erlaubt sind ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    };
  }

  if (sizeBytes === 0) {
    return { ok: false, error: "Die Datei ist leer." };
  }

  return { ok: true };
}
