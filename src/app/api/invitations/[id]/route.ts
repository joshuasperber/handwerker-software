import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { notifyInvitation } from "@/lib/notifications";

const INVITATION_TTL_DAYS = 7;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invitations.manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();
  const action = body.action as "revoke" | "resend" | undefined;

  const invitation = await prisma.invitation.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!invitation) return apiError("Einladung nicht gefunden", 404);
  if (invitation.status === "ACCEPTED") {
    return apiError("Eine angenommene Einladung kann nicht geändert werden", 400);
  }

  if (action === "revoke") {
    const updated = await prisma.invitation.update({
      where: { id },
      data: { status: "REVOKED" },
    });
    return apiSuccess(updated);
  }

  if (action === "resend") {
    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const updated = await prisma.invitation.update({
      where: { id },
      data: { token, status: "PENDING", expiresAt },
    });
    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { name: true },
    });
    const acceptUrl = `${new URL(request.url).origin}/einladung/${token}`;
    await notifyInvitation(
      auth.tenantId,
      invitation.email,
      tenant?.name ?? "Handwerker App",
      acceptUrl,
      invitation.message
    );
    return apiSuccess(updated);
  }

  return apiError("Unbekannte Aktion", 400);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invitations.manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const invitation = await prisma.invitation.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!invitation) return apiError("Einladung nicht gefunden", 404);

  await prisma.invitation.delete({ where: { id } });
  return apiSuccess({ id });
}
