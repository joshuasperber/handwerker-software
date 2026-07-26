import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import {
  getProjectOrNull,
  mapProjectListItem,
} from "@/lib/projects/overview";
import {
  parseOptionalDate,
  validateProjectInput,
  PROJECT_STATUSES,
  type ProjectInput,
} from "@/lib/projects/types";
import type { ProjectStatus } from "@/generated/prisma/client";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  customerId: z.string().min(1),
  addressStreet: z.string().max(200).optional().nullable(),
  addressZip: z.string().max(20).optional().nullable(),
  addressCity: z.string().max(100).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.enum(["GEPLANT", "AKTIV", "PAUSIERT", "ABGESCHLOSSEN", "ABGERECHNET", "STORNIERT"]).optional(),
  description: z.string().max(5000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  teamId: z.string().optional().nullable(),
  employeeIds: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status");

  const projects = await prisma.project.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(status && PROJECT_STATUSES.includes(status as ProjectStatus)
        ? { status: status as ProjectStatus }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { customer: { lastName: { contains: q, mode: "insensitive" } } },
              { customer: { firstName: { contains: q, mode: "insensitive" } } },
              { addressStreet: { contains: q, mode: "insensitive" } },
              { addressCity: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      team: { select: { id: true, name: true } },
      members: {
        include: {
          employee: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          title: true,
          status: true,
          createdAt: true,
          scheduledStart: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: { select: { notesEntries: true, files: true, costs: true, orders: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return apiSuccess(projects.map(mapProjectListItem));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const data = parsed.data as ProjectInput;
  const validationError = validateProjectInput(data);
  if (validationError) return apiError(validationError);

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!customer) return apiError("Kunde nicht gefunden", 404);

  if (data.teamId) {
    const team = await prisma.team.findFirst({
      where: { id: data.teamId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!team) return apiError("Team nicht gefunden", 404);
  }

  const employeeIds = [...new Set(data.employeeIds ?? [])];
  if (employeeIds.length) {
    const count = await prisma.employee.count({
      where: { tenantId: auth.tenantId, id: { in: employeeIds } },
    });
    if (count !== employeeIds.length) {
      return apiError("Ein oder mehrere Mitarbeiter wurden nicht gefunden", 404);
    }
  }

  const project = await prisma.project.create({
    data: {
      tenantId: auth.tenantId,
      name: data.name.trim(),
      customerId: data.customerId,
      addressStreet: data.addressStreet?.trim() || null,
      addressZip: data.addressZip?.trim() || null,
      addressCity: data.addressCity?.trim() || null,
      startDate: parseOptionalDate(data.startDate),
      endDate: parseOptionalDate(data.endDate),
      status: (data.status as ProjectStatus) ?? "GEPLANT",
      description: data.description?.trim() || null,
      notes: data.notes?.trim() || null,
      teamId: data.teamId || null,
      members: employeeIds.length
        ? { create: employeeIds.map((employeeId) => ({ employeeId })) }
        : undefined,
    },
  });

  const full = await getProjectOrNull(auth.tenantId, project.id);
  return apiSuccess(full ? mapProjectListItem(full) : project, 201);
}
