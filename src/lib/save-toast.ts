import { toast } from "sonner";
import { fetchJson, type ApiResponse } from "@/lib/fetch-json";

export type SaveToastMessages = {
  loading?: string;
  success?: string;
  error?: string;
};

const DEFAULTS: Required<SaveToastMessages> = {
  loading: "Wird gespeichert …",
  success: "Erfolgreich gespeichert",
  error: "Speichern fehlgeschlagen",
};

/**
 * Führt einen Speicher-Request aus und zeigt dem Nutzer sichtbares Feedback:
 * eine Ladeanimation mit „Wird gespeichert …“, danach „Erfolgreich gespeichert“
 * oder eine verständliche Fehlermeldung.
 *
 * Nutzt das einheitliche {@link ApiResponse}-Format (`{ success, data, error }`),
 * wirft also nicht bei fachlichen Fehlern, sondern liefert sie im Ergebnis.
 */
export async function saveJson<T = unknown>(
  url: string,
  init?: RequestInit,
  messages?: SaveToastMessages
): Promise<ApiResponse<T>> {
  const msg = { ...DEFAULTS, ...messages };
  const toastId = toast.loading(msg.loading);

  const res = await fetchJson<T>(url, init);

  if (res.success) {
    toast.success(msg.success, { id: toastId });
  } else {
    toast.error(res.error ?? msg.error, { id: toastId });
  }

  return res;
}

/**
 * Allgemeine Variante für beliebige asynchrone Aktionen (nicht nur fetch).
 * Zeigt dieselbe Lade-/Erfolgs-/Fehler-Rückmeldung wie {@link saveJson}.
 */
export async function runWithToast<T>(
  action: () => Promise<T>,
  messages?: SaveToastMessages
): Promise<T> {
  const msg = { ...DEFAULTS, ...messages };
  const toastId = toast.loading(msg.loading);

  try {
    const result = await action();
    toast.success(msg.success, { id: toastId });
    return result;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : msg.error, { id: toastId });
    throw err;
  }
}
