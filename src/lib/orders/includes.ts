import type { Prisma } from "@/generated/prisma/client";

/** Schlanke Includes für Auftragslisten (Dashboard, API GET /orders). */
export const ORDER_LIST_INCLUDE = {
  customer: true,
  property: true,
  services: { include: { service: true } },
  phases: { orderBy: { sortOrder: "asc" as const } },
  project: { select: { id: true, name: true } },
  orderTypeDefinition: { select: { id: true, name: true, isOther: true, isActive: true } },
} satisfies Prisma.OrderInclude;

/** Vollständige Includes für Auftragsdetail. */
export const ORDER_DETAIL_INCLUDE = {
  customer: true,
  property: true,
  services: { include: { service: true } },
  appointments: { include: { employee: { include: { user: true } } } },
  assignees: {
    include: {
      employee: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              role: true,
              isActive: true,
            },
          },
          teamMemberships: {
            include: { team: { select: { id: true, name: true } } },
          },
        },
      },
    },
  },
  files: true,
  checklists: { orderBy: { sortOrder: "asc" as const } },
  messages: { orderBy: { createdAt: "desc" as const }, include: { sender: true } },
  timeEntries: {
    include: {
      employee: {
        include: { user: true },
        // hourlyWageNet is on Employee — included by default
      },
    },
    orderBy: { startTime: "desc" as const },
  },
  materialUsages: { include: { employee: { include: { user: true } } } },
  phases: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      assignedTeam: { select: { id: true, name: true } },
      assignedEmployee: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      files: { orderBy: { createdAt: "desc" as const } },
    },
  },
  materialLines: { include: { article: true, reservations: true } },
  team: {
    include: { members: { include: { employee: { include: { user: true } } } } },
  },
  vehicle: true,
  planMarkers: { include: { article: true, file: true } },
  project: { select: { id: true, name: true, status: true } },
  orderTypeDefinition: true,
} satisfies Prisma.OrderInclude;
