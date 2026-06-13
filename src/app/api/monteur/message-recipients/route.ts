import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

/** Büro-Ansprechpartner für Direktnachrichten (Monteur → Admin/Büro). */
export async function GET() {
  const auth = await requireAuth("messages.write");
  if (auth instanceof Response) return auth;

  const users = await prisma.user.findMany({
    where: {
      tenantId: auth.tenantId,
      isActive: true,
      role: { in: ["ADMIN", "BUERO", "MEISTER"] },
      id: { not: auth.id },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return apiSuccess(users);
}
