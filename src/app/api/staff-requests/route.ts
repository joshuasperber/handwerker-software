import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getEmployeeForUser } from "@/lib/monteur-access";
import {
  staffSkipMessage,
  validateStaffRequestTargets,
} from "@/lib/staff-request-validation";
import { queueStaffRequestCreated } from "@/lib/inngest/dispatch";

export async function GET(request: NextRequest) {
  try {
    const mine = request.nextUrl.searchParams.get("mine") === "1";
    const orderId = request.nextUrl.searchParams.get("orderId");
    const date = request.nextUrl.searchParams.get("date");

    if (mine) {
      const authMonteur = await requireAuth("monteur.own");
      if (authMonteur instanceof Response) return authMonteur;
      const employee = await getEmployeeForUser(authMonteur);
      if (!employee) return apiSuccess([]);

      const requests = await prisma.staffAssignmentRequest.findMany({
        where: {
          tenantId: authMonteur.tenantId,
          employeeId: employee.id,
          status: "PENDING",
          requestedById: { not: authMonteur.id },
        },
        include: {
          order: {
            include: {
              customer: true,
              property: true,
              services: { include: { service: true } },
            },
          },
          requestedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const filtered = date
        ? requests.filter((r) => {
            const t = r.startTime ?? r.order.scheduledStart;
            if (!t) return true;
            return t.toISOString().slice(0, 10) === date;
          })
        : requests;

      return apiSuccess(filtered);
    }

    const auth = await requireAuth("orders.read");
    if (auth instanceof Response) return auth;

    const requests = await prisma.staffAssignmentRequest.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(orderId ? { orderId } : {}),
      },
      include: {
        employee: { include: { user: true } },
        requestedBy: { select: { firstName: true, lastName: true } },
        order: { select: { orderNumber: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(requests);
  } catch (err) {
    console.error("[staff-requests GET]", err);
    return apiError(
      "Personal-Anfragen konnten nicht geladen werden. Bitte Datenbank aktualisieren (npm run db:push).",
      500
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("orders.assign");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { orderId, employeeIds, message, startTime, endTime } = body;

  if (!orderId || !employeeIds?.length) {
    return apiError("orderId und mindestens ein Mitarbeiter erforderlich", 400);
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: auth.tenantId },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  let validIds: string[];
  let skipped: { employeeId: string; reason: import("@/lib/staff-request-validation").StaffRequestSkipReason }[];
  try {
    ({ validIds, skipped } = await validateStaffRequestTargets(
      auth.tenantId,
      orderId,
      employeeIds as string[],
      auth.id
    ));
  } catch {
    return apiError("Auftrag nicht gefunden", 404);
  }

  if (!validIds.length) {
    const first = skipped[0];
    return apiError(first ? staffSkipMessage(first.reason) : "Keine gültigen Mitarbeiter ausgewählt", 400);
  }

  const slotStart = startTime ? new Date(startTime) : order.scheduledStart;
  const slotEnd = endTime ? new Date(endTime) : order.scheduledEnd;

  const created = [];
  for (const employeeId of validIds) {
    const req = await prisma.staffAssignmentRequest.create({
      data: {
        tenantId: auth.tenantId,
        orderId,
        employeeId,
        requestedById: auth.id,
        message,
        startTime: slotStart,
        endTime: slotEnd,
      },
      include: { employee: { include: { user: true } } },
    });
    created.push(req);
    await queueStaffRequestCreated({
      tenantId: auth.tenantId,
      orderId,
      orderNumber: order.orderNumber,
      employeeId,
      message,
    }).catch((err) => console.error("[staff-request notify]", err));
  }

  return apiSuccess({ created, count: created.length, skipped }, 201);
}
