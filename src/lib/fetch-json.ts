export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

/** Fetch helper that never throws on empty or invalid JSON bodies. */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    if (!text.trim()) {
      return {
        success: false,
        error: res.ok ? "Leere Server-Antwort" : `HTTP ${res.status}`,
      };
    }
    return JSON.parse(text) as ApiResponse<T>;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Anfrage fehlgeschlagen",
    };
  }
}
