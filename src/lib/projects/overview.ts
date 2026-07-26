import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/storage";
import { ORDER_STATUS_LABELS } from "@/lib/utils";
import { NON_PHOTO_CATEGORIES, fileCategoryLabel } from "@/lib/files";
import {
  PROJECT_COST_SOURCE_LABELS,
  PROJECT_STATUS_LABELS,
} from "./types";

const projectInclude = {
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
    orderBy: { createdAt: "desc" as const },
  },
  _count: {
    select: {
      notesEntries: true,
      files: true,
      costs: true,
      orders: true,
    },
  },
} as const;

export async function getProjectOrNull(tenantId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, tenantId },
    include: projectInclude,
  });
}

export function mapProjectListItem(
  project: NonNullable<Awaited<ReturnType<typeof getProjectOrNull>>>
) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    statusLabel: PROJECT_STATUS_LABELS[project.status],
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
    addressStreet: project.addressStreet,
    addressZip: project.addressZip,
    addressCity: project.addressCity,
    description: project.description,
    notes: project.notes,
    customer: {
      id: project.customer.id,
      name: `${project.customer.firstName} ${project.customer.lastName}`.trim(),
      email: project.customer.email,
    },
    team: project.team,
    members: project.members.map((m) => ({
      id: m.id,
      employeeId: m.employeeId,
      name: `${m.employee.user.firstName} ${m.employee.user.lastName}`.trim(),
    })),
    orders: project.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      title: o.title,
      status: o.status,
      statusLabel: ORDER_STATUS_LABELS[o.status] ?? o.status,
      createdAt: o.createdAt.toISOString(),
      scheduledStart: o.scheduledStart?.toISOString() ?? null,
    })),
    counts: project._count,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function getProjectClosingOverview(tenantId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      team: { select: { id: true, name: true } },
      orders: {
        include: {
          materialLines: {
            include: {
              article: {
                select: { name: true, unit: true, salesPriceNet: true, purchasePriceNet: true },
              },
            },
          },
          materialUsages: true,
          files: {
            where: { category: { notIn: NON_PHOTO_CATEGORIES } },
            include: { uploadedBy: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" },
          },
          calculations: {
            include: {
              documents: {
                where: { documentType: "INVOICE", status: { not: "STORNIERT" } },
                include: { payments: true },
              },
            },
          },
          expenses: true,
        },
        orderBy: { createdAt: "asc" },
      },
      notesEntries: {
        include: {
          createdBy: { select: { firstName: true, lastName: true } },
          order: { select: { id: true, orderNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      files: {
        include: {
          uploadedBy: { select: { firstName: true, lastName: true } },
          order: { select: { id: true, orderNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      costs: {
        include: {
          order: { select: { id: true, orderNumber: true } },
          article: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      expenses: true,
      calculations: {
        include: {
          documents: {
            where: { documentType: "INVOICE" },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!project) return null;

  const orderFiles = await Promise.all(
    project.orders.flatMap((order) =>
      order.files.map(async (f) => ({
        id: f.id,
        scope: "order" as const,
        orderId: order.id,
        orderNumber: order.orderNumber,
        fileName: f.fileName,
        mimeType: f.mimeType,
        category: f.category,
        categoryLabel: fileCategoryLabel(f.category),
        description: f.description,
        createdAt: f.createdAt.toISOString(),
        uploadedBy: f.uploadedBy
          ? `${f.uploadedBy.firstName} ${f.uploadedBy.lastName}`.trim()
          : null,
        url: await getSignedDownloadUrl(f.storageKey).catch(() => null),
      }))
    )
  );

  const projectFiles = await Promise.all(
    project.files.map(async (f) => ({
      id: f.id,
      scope: "project" as const,
      orderId: f.orderId,
      orderNumber: f.order?.orderNumber ?? null,
      fileName: f.fileName,
      mimeType: f.mimeType,
      category: f.category,
      categoryLabel: fileCategoryLabel(f.category),
      description: f.description,
      createdAt: f.createdAt.toISOString(),
      uploadedBy: f.uploadedBy
        ? `${f.uploadedBy.firstName} ${f.uploadedBy.lastName}`.trim()
        : null,
      url: await getSignedDownloadUrl(f.storageKey).catch(() => null),
    }))
  );

  const materials = [
    ...project.orders.flatMap((order) =>
      order.materialLines.map((line) => ({
        id: `ml-${line.id}`,
        source: "ORDER_MATERIAL" as const,
        description: line.name,
        quantity: line.quantityRequired,
        unit: line.unit,
        netAmount:
          line.article?.salesPriceNet != null
            ? line.article.salesPriceNet * line.quantityRequired
            : line.article?.purchasePriceNet != null
              ? line.article.purchasePriceNet * line.quantityRequired
              : 0,
        orderId: order.id,
        orderNumber: order.orderNumber,
      }))
    ),
    ...project.costs
      .filter((c) => c.source === "INVENTORY" || c.source === "ORDER_MATERIAL")
      .map((c) => ({
        id: c.id,
        source: c.source,
        description: c.description,
        quantity: c.quantity,
        unit: c.unit,
        netAmount: c.netAmount,
        orderId: c.orderId,
        orderNumber: c.order?.orderNumber ?? null,
      })),
  ];

  const costs = project.costs.map((c) => ({
    id: c.id,
    source: c.source,
    sourceLabel: PROJECT_COST_SOURCE_LABELS[c.source],
    description: c.description,
    quantity: c.quantity,
    unit: c.unit,
    netAmount: c.netAmount,
    vatAmount: c.vatAmount,
    grossAmount: c.grossAmount,
    paidAmount: c.paidAmount,
    openAmount: Math.max(0, c.grossAmount - c.paidAmount),
    isReimbursable: c.isReimbursable,
    isBillable: c.isBillable,
    orderId: c.orderId,
    orderNumber: c.order?.orderNumber ?? null,
    articleName: c.article?.name ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  // Aggregierte Rechnungszahlungen aus verknüpften Aufträgen + Projekt-Kalkulationen
  let paidFromInvoices = 0;
  let openFromInvoices = 0;
  let invoiceGross = 0;
  for (const order of project.orders) {
    for (const calc of order.calculations) {
      for (const doc of calc.documents) {
        invoiceGross += doc.grossAmount;
        paidFromInvoices += doc.paidAmount;
        openFromInvoices += Math.max(0, doc.grossAmount - doc.paidAmount);
      }
    }
  }
  for (const calc of project.calculations) {
    for (const doc of calc.documents) {
      if (doc.status === "STORNIERT") continue;
      invoiceGross += doc.grossAmount;
      paidFromInvoices += doc.paidAmount;
      openFromInvoices += Math.max(0, doc.grossAmount - doc.paidAmount);
    }
  }

  const costNet = costs.reduce((s, c) => s + c.netAmount, 0);
  const costGross = costs.reduce((s, c) => s + c.grossAmount, 0);
  const costPaid = costs.reduce((s, c) => s + c.paidAmount, 0);
  const reimbursable = costs.filter((c) => c.isReimbursable);
  const billable = costs.filter((c) => c.isBillable);

  const invoiceCandidates = [
    ...billable.map((c) => ({
      id: `cost:${c.id}`,
      kind: "cost" as const,
      costId: c.id,
      orderId: c.orderId,
      label: c.description,
      netAmount: c.netAmount,
      selectedByDefault: true,
    })),
    ...project.orders.map((o) => ({
      id: `order:${o.id}`,
      kind: "order" as const,
      costId: null as string | null,
      orderId: o.id,
      label: `${o.orderNumber}${o.title ? ` · ${o.title}` : ""}`,
      netAmount: 0,
      selectedByDefault: false,
    })),
  ];

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      statusLabel: PROJECT_STATUS_LABELS[project.status],
      description: project.description,
      notes: project.notes,
      startDate: project.startDate?.toISOString() ?? null,
      endDate: project.endDate?.toISOString() ?? null,
      address: [project.addressStreet, [project.addressZip, project.addressCity].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", "),
      customer: {
        id: project.customer.id,
        name: `${project.customer.firstName} ${project.customer.lastName}`.trim(),
      },
      team: project.team,
    },
    orders: project.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      title: o.title,
      status: o.status,
      statusLabel: ORDER_STATUS_LABELS[o.status] ?? o.status,
      createdAt: o.createdAt.toISOString(),
    })),
    materials,
    costs,
    notes: project.notesEntries.map((n) => ({
      id: n.id,
      body: n.body,
      orderId: n.orderId,
      orderNumber: n.order?.orderNumber ?? null,
      createdAt: n.createdAt.toISOString(),
      createdBy: n.createdBy
        ? `${n.createdBy.firstName} ${n.createdBy.lastName}`.trim()
        : null,
    })),
    photos: [...projectFiles, ...orderFiles].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    ),
    totals: {
      costNet,
      costGross,
      costPaid,
      costOpen: Math.max(0, costGross - costPaid),
      reimbursableNet: reimbursable.reduce((s, c) => s + c.netAmount, 0),
      reimbursableCount: reimbursable.length,
      billableNet: billable.reduce((s, c) => s + c.netAmount, 0),
      billableCount: billable.length,
      invoiceGross,
      invoicePaid: paidFromInvoices,
      invoiceOpen: openFromInvoices,
    },
    invoiceCandidates,
    existingCalculations: project.calculations.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      netSalesPrice: c.netSalesPrice,
      grossSalesPrice: c.grossSalesPrice,
      updatedAt: c.updatedAt.toISOString(),
      invoiceNumber: c.documents[0]?.documentNumber ?? null,
    })),
  };
}
