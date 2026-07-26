import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api";
import { provisionEmptyTenant } from "@/lib/tenants/provision";
import {
  createSession,
  COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  companyName: z.string().min(2, "Betriebsname zu kurz"),
  slug: z.string().optional(),
  firstName: z.string().min(1, "Vorname fehlt"),
  lastName: z.string().min(1, "Nachname fehlt"),
  email: z.string().email(),
  password: z.string().min(8, "Passwort mindestens 8 Zeichen"),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe", 400);
    }

    const result = await provisionEmptyTenant({
      name: parsed.data.companyName,
      slug: parsed.data.slug,
      adminEmail: parsed.data.email,
      adminPassword: parsed.data.password,
      adminFirstName: parsed.data.firstName,
      adminLastName: parsed.data.lastName,
    });

    if (!result.ok) return apiError(result.error, 400);

    const user = await prisma.user.findFirstOrThrow({ where: { id: result.userId } });
    const token = await createSession({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      mustChangePassword: user.mustChangePassword,
      sessionVersion: user.sessionVersion,
    });

    const response = apiSuccess(
      {
        tenantId: result.tenantId,
        slug: result.slug,
        redirectTo: "/dashboard",
      },
      201
    );
    response.cookies.set(COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (err) {
    console.error("[auth/register]", err);
    const message = err instanceof Error ? err.message : "Registrierung fehlgeschlagen";
    return apiError(message, 500);
  }
}
