import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  login,
  createSession,
  COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  applySessionCookie,
} from "@/lib/auth";
import { apiSuccess, apiError, getClientIp } from "@/lib/api";
import { getRoleHomePath } from "@/lib/role-routing";
import {
  isLoginRateLimited,
  recordLoginAttempt,
  pruneLoginAttempts,
} from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "demo";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantSlug: z.string().min(1, "Betriebs-Kürzel fehlt"),
});

function wantsJsonResponse(request: NextRequest): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return true;
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function loginErrorRedirect(request: NextRequest, code: string): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url, 303);
}

function mapLoginError(err: unknown) {
  if (process.env.NODE_ENV === "development") {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("DATABASE_URL is not set")) {
      return apiError(
        "Datenbank nicht konfiguriert. DATABASE_URL in Vercel setzen (Supabase Connection String).",
        503
      );
    }
    if (message.includes("JWT_SECRET is not set")) {
      return apiError("Auth nicht konfiguriert. JWT_SECRET in Vercel setzen.", 503);
    }
    return apiError(`Anmeldung fehlgeschlagen: ${message.slice(0, 120)}`, 500);
  }
  return apiError(
    "Anmeldung vorübergehend nicht möglich. Bitte später erneut versuchen.",
    503
  );
}

async function parseLoginInput(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return loginSchema.safeParse(await request.json());
  }

  const formData = await request.formData();
  return loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    tenantSlug:
      String(formData.get("tenantSlug") ?? "").trim() || DEFAULT_TENANT,
  });
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseLoginInput(request);
    const jsonClient = wantsJsonResponse(request);

    if (!parsed.success) {
      return jsonClient
        ? apiError("Ungültige Anmeldedaten", 400)
        : loginErrorRedirect(request, "invalid");
    }

    const ip = getClientIp(request);
    const rate = await isLoginRateLimited(parsed.data.email, ip);
    if (rate.limited) {
      return jsonClient
        ? apiError(rate.reason ?? "Zu viele Versuche", 429)
        : loginErrorRedirect(request, "rate");
    }

    const user = await login(
      parsed.data.email,
      parsed.data.password,
      parsed.data.tenantSlug
    );

    await recordLoginAttempt(parsed.data.email, ip, Boolean(user));
    void pruneLoginAttempts().catch(() => undefined);

    if (!user) {
      return jsonClient
        ? apiError("E-Mail oder Passwort falsch", 401)
        : loginErrorRedirect(request, "invalid");
    }

    const token = await createSession(user);

    if (jsonClient) {
      const response = apiSuccess({ user });
      response.cookies.set(COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
      return response;
    }

    const home = getRoleHomePath(user.role, {
      mustChangePassword: user.mustChangePassword,
    });
    const response = NextResponse.redirect(new URL(home, request.url), 303);
    applySessionCookie(response, token);
    return response;
  } catch (err) {
    logger.error("login failed", { route: "/api/auth/login" }, err);
    const jsonClient = wantsJsonResponse(request);
    const mapped = mapLoginError(err);
    if (jsonClient) return mapped;

    const status = mapped.status ?? 500;
    const code = status >= 500 ? "server" : "invalid";
    return loginErrorRedirect(request, code);
  }
}
