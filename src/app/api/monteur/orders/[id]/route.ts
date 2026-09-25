import { requireAuth, apiSuccess } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";
import { prisma } from "@/lib/prisma";

/** Auftragsdetails für Monteur – nur zugewiesene Aufträge, ohne interne Notizen/Nachrichten. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const access = await requireMonteurOrder(auth, id);
  if ("error" in access && access.error) return access.error;

  const order = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: {
      id: true,
      orderNumber: true,
      title: true,
      status: true,
      description: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          company: true,
          contactPerson: true,
          phone: true,
        },
      },
      property: {
        select: {
          label: true,
          street: true,
          zipCode: true,
          city: true,
        },
      },
      checklists: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, label: true, isChecked: true },
      },
      materialLines: {
        select: {
          id: true,
          name: true,
          quantityRequired: true,
          quantityConsumed: true,
          unit: true,
          isTool: true,
        },
      },
      materialUsages: {
        select: { name: true, quantity: true, unit: true },
      },
      timeEntries: {
        where: { employeeId: access.employee.id },
        select: { id: true, startTime: true, endTime: true, breakMinutes: true },
        orderBy: { startTime: "desc" },
        take: 20,
      },
      phases: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          status: true,
          sortOrder: true,
          plannedStart: true,
          plannedEnd: true,
          assignedTeamId: true,
          assignedEmployeeId: true,
        },
      },
    },
  });

  return apiSuccess(order);
}
