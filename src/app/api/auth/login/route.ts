import { NextRequest } from "next/server";
import { z } from "zod";
import { login, createSession, setSessionCookie } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantSlug: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Ungültige Anmeldedaten", 400);
    }

    const user = await login(
      parsed.data.email,
      parsed.data.password,
      parsed.data.tenantSlug
    );

    if (!user) {
      return apiError("E-Mail oder Passwort falsch", 401);
    }

    const token = await createSession(user);
    await setSessionCookie(token);

    return apiSuccess({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (
      message.includes("connect") ||
      message.includes("ECONNREFUSED") ||
      message.includes("Can't reach database")
    ) {
      return apiError(
        "Datenbank nicht erreichbar. Bitte Docker starten und „npm run setup“ ausführen.",
        503
      );
    }
    return apiError("Anmeldung fehlgeschlagen", 500);
  }
}
