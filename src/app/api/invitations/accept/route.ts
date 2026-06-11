import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";

/** Lädt eine Einladung anhand des Tokens und prüft ihre Gültigkeit. */
async function loadValidInvitation(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { tenant: { select: { name: true } } },
  });
  if (!invitation) return { error: "Einladung nicht gefunden" as const };
  if (invitation.status === "ACCEPTED") return { error: "Einladung wurde bereits angenommen" as const };
  if (invitation.status === "REVOKED") return { error: "Einladung wurde zurückgezogen" as const };
  if (invitation.status === "EXPIRED" || invitation.expiresAt < new Date()) {
    if (invitation.status !== "EXPIRED") {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
    }
    return { error: "Einladung ist abgelaufen" as const };
  }
  return { invitation };
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return apiError("Token fehlt", 400);

  const result = await loadValidInvitation(token);
  if ("error" in result) return apiError(result.error ?? "Einladung ungültig", 400);

  const { invitation } = result;
  return apiSuccess({
    email: invitation.email,
    role: invitation.role,
    companyName: invitation.tenant.name,
    message: invitation.message,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const token = (body.token ?? "").trim();
  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const password = body.password ?? "";

  if (!token) return apiError("Token fehlt", 400);
  if (!firstName || !lastName) return apiError("Bitte Vor- und Nachnamen angeben", 400);
  if (typeof password !== "string" || password.length < 8) {
    return apiError("Passwort muss mindestens 8 Zeichen haben", 400);
  }

  const result = await loadValidInvitation(token);
  if ("error" in result) return apiError(result.error ?? "Einladung ungültig", 400);
  const { invitation } = result;

  const existingUser = await prisma.user.findFirst({
    where: { tenantId: invitation.tenantId, email: invitation.email },
  });
  if (existingUser) return apiError("Für diese E-Mail existiert bereits ein Konto", 409);

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      tenantId: invitation.tenantId,
      email: invitation.email,
      passwordHash,
      firstName,
      lastName,
      role: invitation.role,
      isActive: true,
    },
  });

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedUserId: user.id },
  });

  const sessionUser = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
  const sessionToken = await createSession(sessionUser);
  await setSessionCookie(sessionToken);

  const redirectTo = invitation.role === "GAST" ? "/portal" : "/dashboard";
  return apiSuccess({ user: sessionUser, redirectTo }, 201);
}
