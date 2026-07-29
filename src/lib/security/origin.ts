import { NextRequest } from "next/server";
import { apiError } from "@/lib/api";

/**
 * Einfacher Origin-/Referer-Check für Cookie-basierte state-changing Requests.
 * Kein Ersatz für CSRF-Tokens, aber sinnvoller SameSite-ergänzender Schutz.
 */
export function assertSameOrigin(request: NextRequest): Response | null {
  const host = request.headers.get("host");
  if (!host) return null;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== host) {
        return apiError("Ungültige Anfrage-Herkunft (Origin)", 403);
      }
      return null;
    } catch {
      return apiError("Ungültige Anfrage-Herkunft (Origin)", 403);
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).host !== host) {
        return apiError("Ungültige Anfrage-Herkunft (Referer)", 403);
      }
    } catch {
      return apiError("Ungültige Anfrage-Herkunft (Referer)", 403);
    }
  }

  return null;
}
