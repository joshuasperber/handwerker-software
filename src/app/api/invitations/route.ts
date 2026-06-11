import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { notifyInvitation } from "@/lib/notifications";
import type { UserRole } from "@/generated/prisma/client";

const INVITABLE_ROLES: UserRole[] = ["GAST", "MONTEUR", "BUERO", "MEISTER"];
const INVITATION_TTL_DAYS = 7;

/** Markiert abgelaufene PENDING-Einladungen, bevor gelistet wird. */
async function expireStaleInvitations(tenantId: string) {
  await prisma.invitation.updateMany({
    where: { tenantId, status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

export async function GET() {
  const auth = await requireAuth("invitations.manage");
  if (auth instanceof Response) return auth;

  await expireStaleInvitations(auth.tenantId);

  const invitations = await prisma.invitation.findMany({
    where: { tenantId: auth.tenantId },
    include: {
      invitedBy: { select: { firstName: true, lastName: true } },
      acceptedUser: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return apiSuccess(invitations);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("invitations.manage");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const email = (body.email ?? "").trim().toLowerCase();
  const role = (body.role ?? "GAST") as UserRole;
  const message = (body.message ?? "").trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError("Bitte eine gültige E-Mail-Adresse angeben", 400);
  }
  if (!INVITABLE_ROLES.includes(role)) {
    return apiError("Ungültige Rolle für Einladung", 400);
  }

  const existingUser = await prisma.user.findFirst({
    where: { tenantId: auth.tenantId, email },
  });
  if (existingUser) {
    return apiError("Für diese E-Mail existiert bereits ein Konto", 409);
  }

  // Offene Einladung für dieselbe E-Mail erneut ausstellen statt zu duplizieren.
  await prisma.invitation.updateMany({
    where: { tenantId: auth.tenantId, email, status: "PENDING" },
    data: { status: "REVOKED" },
  });

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      tenantId: auth.tenantId,
      email,
      role,
      token,
      message,
      invitedById: auth.id,
      expiresAt,
    },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { name: true },
  });
  const acceptUrl = `${new URL(request.url).origin}/einladung/${token}`;
  await notifyInvitation(auth.tenantId, email, tenant?.name ?? "Handwerker App", acceptUrl, message);

  return apiSuccess(invitation, 201);
}
