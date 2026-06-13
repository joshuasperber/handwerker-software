export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
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
      const error = res.ok ? "Leere Server-Antwort" : `HTTP ${res.status}`;
      if (res.status === 401 && typeof window !== "undefined") {
        window.location.assign("/login");
      }
      return { success: false, error, status: res.status };
    }

    const parsed = JSON.parse(text) as ApiResponse<T>;

    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined") {
        window.location.assign("/login");
      }
      return {
        success: false,
        error: parsed.error ?? `HTTP ${res.status}`,
        status: res.status,
      };
    }

    return { ...parsed, status: res.status };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Anfrage fehlgeschlagen",
    };
  }
}
