import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { createSession, setSessionCookie } from "@/lib/auth";

/** Maximale Länge einer als Data-URL gespeicherten Profilbild-Eingabe (~1,5 MB). */
const MAX_AVATAR_LENGTH = 1_500_000;

const updateSchema = z.object({
  firstName: z.string().trim().min(1, "Vorname darf nicht leer sein").optional(),
  lastName: z.string().trim().min(1, "Nachname darf nicht leer sein").optional(),
  email: z.string().trim().email("Ungültige E-Mail-Adresse").optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  avatarUrl: z
    .string()
    .max(MAX_AVATAR_LENGTH, "Profilbild ist zu groß")
    .optional()
    .nullable(),
});

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const user = await prisma.user.findFirst({
    where: { id: auth.id, tenantId: auth.tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      address: true,
      avatarUrl: true,
      role: true,
      mustChangePassword: true,
    },
  });

  if (!user) return apiError("Profil nicht gefunden", 404);
  return apiSuccess(user);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe", 400);
  }
  const { firstName, lastName, email, phone, address, avatarUrl } = parsed.data;

  if (email) {
    const normalized = email.toLowerCase();
    const existing = await prisma.user.findFirst({
      where: {
        tenantId: auth.tenantId,
        email: normalized,
        NOT: { id: auth.id },
      },
    });
    if (existing) return apiError("E-Mail bereits vergeben", 400);
  }

  const updated = await prisma.user.update({
    where: { id: auth.id },
    data: {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(email !== undefined ? { email: email.toLowerCase() } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      address: true,
      avatarUrl: true,
      role: true,
      mustChangePassword: true,
    },
  });

  // Session-Cookie aktualisieren, damit Name/E-Mail/Avatar sofort überall stimmen.
  const token = await createSession({
    id: updated.id,
    tenantId: updated.tenantId,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    role: updated.role,
    avatarUrl: updated.avatarUrl,
    mustChangePassword: updated.mustChangePassword,
  });
  await setSessionCookie(token);

  return apiSuccess(updated);
}
