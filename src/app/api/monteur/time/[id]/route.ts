import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getEmployeeForUser } from "@/lib/monteur-access";

async function requireOwnTimeEntry(auth: Awaited<ReturnType<typeof requireAuth>>, entryId: string) {
  if (auth instanceof Response) return { error: auth };

  const employee = await getEmployeeForUser(auth);
  if (!employee) return { error: apiError("Kein Mitarbeiterprofil", 403) };

  const entry = await prisma.timeEntry.findFirst({
    where: {
      id: entryId,
      employeeId: employee.id,
      order: { tenantId: auth.tenantId },
    },
  });
  if (!entry) return { error: apiError("Zeiteintrag nicht gefunden", 404) };

  return { auth, employee, entry };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  const { id } = await params;
  const access = await requireOwnTimeEntry(auth, id);
  if ("error" in access) return access.error;

  const body = await request.json();
  const updated = await prisma.timeEntry.update({
    where: { id },
    data: {
      ...(body.startTime !== undefined ? { startTime: new Date(body.startTime) } : {}),
      ...(body.endTime !== undefined ? { endTime: body.endTime ? new Date(body.endTime) : null } : {}),
      ...(body.breakMinutes !== undefined ? { breakMinutes: Number(body.breakMinutes) || 0 } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
    },
  });

  return apiSuccess(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  const { id } = await params;
  const access = await requireOwnTimeEntry(auth, id);
  if ("error" in access) return access.error;

  await prisma.timeEntry.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}
