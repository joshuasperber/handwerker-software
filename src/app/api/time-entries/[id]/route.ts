import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";

/** Status freigeben / prüfen (Büro) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("time_entries.approve");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();
  const status = body.status as string | undefined;

  if (!status || !["OPEN", "REVIEWED", "APPROVED"].includes(status)) {
    return apiError("Ungültiger Status");
  }

  const entry = await prisma.timeEntry.findFirst({
    where: {
      id,
      employee: { tenantId: auth.tenantId },
    },
  });
  if (!entry) return apiError("Eintrag nicht gefunden", 404);

  if (!hasPermission(auth.role, "time_entries.approve")) {
    return apiError("Keine Berechtigung", 403);
  }

  const updated = await prisma.timeEntry.update({
    where: { id },
    data: { status: status as "OPEN" | "REVIEWED" | "APPROVED" },
  });

  return apiSuccess(updated);
}
