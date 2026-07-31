import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { createSession, setSessionCookie } from "@/lib/auth";
import { avatarStorageKey, hasStoredAvatar, toAvatarSrc } from "@/lib/avatar";
import { deleteFile } from "@/lib/storage";

const updateSchema = z.object({
  firstName: z.string().trim().min(1, "Vorname darf nicht leer sein").optional(),
  lastName: z.string().trim().min(1, "Nachname darf nicht leer sein").optional(),
  email: z.string().trim().email("Ungültige E-Mail-Adresse").optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  /** Nur noch zum Entfernen — Upload läuft über POST /api/profile/avatar. */
  avatarUrl: z.null().optional(),
});

function toProfileDTO(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  avatarUrl: string | null;
  role: string;
  mustChangePassword: boolean;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    address: user.address,
    avatarUrl: toAvatarSrc(user.avatarUrl, user.updatedAt),
    hasAvatar: hasStoredAvatar(user.avatarUrl),
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

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
      updatedAt: true,
    },
  });

  if (!user) return apiError("Profil nicht gefunden", 404);
  return apiSuccess(toProfileDTO(user));
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

  const previous =
    avatarUrl === null
      ? await prisma.user.findFirst({
          where: { id: auth.id, tenantId: auth.tenantId },
          select: { avatarUrl: true },
        })
      : null;

  const updated = await prisma.user.update({
    where: { id: auth.id },
    data: {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(email !== undefined ? { email: email.toLowerCase() } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
      ...(avatarUrl === null ? { avatarUrl: null } : {}),
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
      updatedAt: true,
      sessionVersion: true,
    },
  });

  if (avatarUrl === null) {
    const key = avatarStorageKey(previous?.avatarUrl);
    if (key) await deleteFile(key).catch(() => {});
  }

  // Session-Cookie aktualisieren (ohne Avatar-Blob — der kommt aus der DB / Proxy-URL).
  const token = await createSession({
    id: updated.id,
    tenantId: updated.tenantId,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    role: updated.role,
    mustChangePassword: updated.mustChangePassword,
    sessionVersion: updated.sessionVersion,
  });
  await setSessionCookie(token);

  return apiSuccess(toProfileDTO(updated));
}
