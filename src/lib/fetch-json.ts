export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
};

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/invitations/accept",
  "/api/public",
  "/api/shared",
  "/api/widget",
  "/api/cron",
  "/api/health",
];

const PUBLIC_PAGE_PREFIXES = [
  "/login",
  "/registrieren",
  "/passwort-vergessen",
  "/buchen",
  "/widget",
  "/einladung",
];

function apiPath(url: string): string {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return new URL(url).pathname;
    }
  } catch {
    /* relative path */
  }
  return url.split("?")[0] ?? url;
}

/** Öffentliche Auth-/Buchungs-APIs dürfen 401 liefern, ohne die Session zu beenden. */
export function shouldRedirectOnUnauthorized(
  url: string,
  status: number,
  currentPath = typeof window !== "undefined" ? window.location.pathname : ""
): boolean {
  if (status !== 401) return false;
  const path = apiPath(url);
  if (!path.startsWith("/api/")) return false;
  if (PUBLIC_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return false;
  }
  if (PUBLIC_PAGE_PREFIXES.some((prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`))) {
    return false;
  }
  return true;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  window.location.assign("/login");
}

/** Fetch helper that never throws on empty or invalid JSON bodies. */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();

    if (shouldRedirectOnUnauthorized(url, res.status)) {
      redirectToLogin();
    }

    if (!text.trim()) {
      const error = res.ok ? "Leere Server-Antwort" : `HTTP ${res.status}`;
      return { success: false, error, status: res.status };
    }

    const parsed = JSON.parse(text) as ApiResponse<T>;

    if (!res.ok) {
      return {
        success: false,
        error: parsed.error ?? `HTTP ${res.status}`,
        status: res.status,
      };
    }

    return { ...parsed, status: res.status };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return {
      success: false,
      error: err instanceof Error ? err.message : "Anfrage fehlgeschlagen",
    };
  }
}
