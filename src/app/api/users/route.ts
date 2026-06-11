import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import type { UserRole } from "@/generated/prisma/client";

/**
 * Liste der Nutzer des Betriebs – für Empfänger- und Freigabe-Auswahl.
 * Zugriff für alle, die Nachrichten schreiben dürfen.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth("messages.write");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const roleParam = searchParams.get("role");
  const roles = roleParam ? (roleParam.split(",") as UserRole[]) : undefined;

  const users = await prisma.user.findMany({
    where: {
      tenantId: auth.tenantId,
      isActive: true,
      id: { not: auth.id },
      ...(roles ? { role: { in: roles } } : {}),
    },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
    take: 200,
  });

  return apiSuccess(users);
}
