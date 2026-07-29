import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/storage";
import { ORDER_STATUS_LABELS } from "@/lib/utils";
import { NON_PHOTO_CATEGORIES, fileCategoryLabel } from "@/lib/files";
import {
  PROJECT_COST_SOURCE_LABELS,
  PROJECT_STATUS_LABELS,
} from "./types";

function timeEntryHours(entry: {
  startTime: Date;
  endTime: Date | null;
  breakMinutes: number;
}): number {
  if (!entry.endTime) return 0;
  const ms = entry.endTime.getTime() - entry.startTime.getTime();
  return Math.max(0, ms / 3_600_000 - (entry.breakMinutes || 0) / 60);
}

function materialLineNet(line: {
  quantityRequired: number;
  unitPriceNet?: number | null;
  article?: { salesPriceNet: number | null; purchasePriceNet: number | null } | null;
}): number {
  const unit =
    line.unitPriceNet ??
    line.article?.salesPriceNet ??
    line.article?.purchasePriceNet ??
    0;
  return unit * line.quantityRequired;
}

function orderInvoiceStatus(order: {
  status: string;
  invoicedAt: Date | null;
  calculations: Array<{
    documents: Array<{ id: string; documentNumber: string | null; status: string }>;
  }>;
}): { key: "OPEN" | "PARTIAL" | "INVOICED"; label: string } {
  const invoices = order.calculations.flatMap((c) => c.documents);
  if (order.status === "ABGERECHNET" || order.invoicedAt || invoices.length > 0) {
    return { key: "INVOICED", label: "Abgerechnet" };
  }
  if (order.status === "ABRECHNUNGSBEREIT") {
    return { key: "PARTIAL", label: "Abrechnungsbereit" };
  }
  return { key: "OPEN", label: "Offen" };
}

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
      invoicedAt: true,
      customer: { select: { firstName: true, lastName: true } },
      materialLines: {
        select: {
          quantityRequired: true,
          unitPriceNet: true,
          isTool: true,
          article: { select: { salesPriceNet: true, purchasePriceNet: true } },
        },
      },
      timeEntries: {
        select: { startTime: true, endTime: true, breakMinutes: true, status: true },
      },
      calculations: {
        select: {
          id: true,
          documents: {
            where: { documentType: "INVOICE", status: { not: "STORNIERT" } },
            select: {
              id: true,
              documentNumber: true,
              status: true,
              grossAmount: true,
              paidAmount: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
  costs: {
    select: {
      orderId: true,
      netAmount: true,
      invoicedAt: true,
    },
  },
  appointments: {
    where: { status: { not: "STORNIERT" } },
    select: {
      id: true,
      title: true,
      color: true,
      startTime: true,
      endTime: true,
      status: true,
      notes: true,
      orderId: true,
      employee: {
        select: { user: { select: { firstName: true, lastName: true } } },
      },
      order: { select: { id: true, orderNumber: true, title: true } },
    },
    orderBy: { startTime: "asc" as const },
  },
  _count: {
    select: {
      notesEntries: true,
      files: true,
      costs: true,
      orders: true,
      appointments: true,
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
    orders: project.orders.map((o) => {
      const materialNet = o.materialLines
        .filter((l) => !l.isTool)
        .reduce((s, l) => s + materialLineNet(l), 0);
      const hours = o.timeEntries.reduce((s, e) => s + timeEntryHours(e), 0);
      const costNet = project.costs
        .filter((c) => c.orderId === o.id)
        .reduce((s, c) => s + c.netAmount, 0);
      const inv = orderInvoiceStatus(o);
      const invoiceDocs = o.calculations.flatMap((c) => c.documents);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        title: o.title,
        status: o.status,
        statusLabel: ORDER_STATUS_LABELS[o.status] ?? o.status,
        createdAt: o.createdAt.toISOString(),
        scheduledStart: o.scheduledStart?.toISOString() ?? null,
        customerName: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
        materialCount: o.materialLines.filter((l) => !l.isTool).length,
        materialNet,
        workHours: Math.round(hours * 100) / 100,
        costNet,
        totalNet: materialNet + costNet,
        invoiceStatus: inv.key,
        invoiceStatusLabel: inv.label,
        invoiceNumbers: invoiceDocs
          .map((d) => d.documentNumber)
          .filter((n): n is string => Boolean(n)),
      };
    }),
    appointments: project.appointments.map((a) => ({
      id: a.id,
      title:
        a.title?.trim() ||
        a.order?.title?.trim() ||
        a.order?.orderNumber ||
        "Termin",
      color: a.color,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      status: a.status,
      notes: a.notes,
      orderId: a.orderId,
      orderNumber: a.order?.orderNumber ?? null,
      employeeName: a.employee
        ? `${a.employee.user.firstName} ${a.employee.user.lastName}`.trim()
        : null,
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
          customer: { select: { firstName: true, lastName: true } },
          services: { include: { service: true } },
          materialLines: {
            include: {
              article: {
                select: { name: true, unit: true, salesPriceNet: true, purchasePriceNet: true },
              },
            },
          },
          materialUsages: true,
          timeEntries: {
            include: {
              employee: {
                include: { user: { select: { firstName: true, lastName: true } } },
              },
            },
          },
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

  const company = await prisma.companySettings.findUnique({
    where: { tenantId },
    select: { defaultHourlyRate: true },
  });
  const hourlyRate = company?.defaultHourlyRate ?? 68;

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
        netAmount: materialLineNet(line),
        orderId: order.id,
        orderNumber: order.orderNumber,
        alreadyBilled: false,
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
        alreadyBilled: Boolean(c.invoicedAt),
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
    alreadyBilled: Boolean(c.invoicedAt),
    invoicedAt: c.invoicedAt?.toISOString() ?? null,
    orderId: c.orderId,
    orderNumber: c.order?.orderNumber ?? null,
    articleName: c.article?.name ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

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
  const billedCosts = costs.filter((c) => c.alreadyBilled);
  const openBillable = billable.filter((c) => !c.alreadyBilled);

  type Candidate = {
    id: string;
    kind:
      | "cost"
      | "order"
      | "service"
      | "material"
      | "time"
      | "machine"
      | "travel"
      | "payment"
      | "other";
    costId: string | null;
    orderId: string | null;
    materialLineId: string | null;
    orderServiceId: string | null;
    timeEntryId: string | null;
    label: string;
    categoryLabel: string;
    netAmount: number;
    selectedByDefault: boolean;
    alreadyBilled: boolean;
    disabled: boolean;
    warning: string | null;
  };

  const invoiceCandidates: Candidate[] = [];

  for (const c of billable) {
    const sourceKind =
      c.source === "INVOICE" || c.paidAmount > 0
        ? ("payment" as const)
        : c.source === "EXPENSE" || c.source === "RECEIPT"
          ? ("other" as const)
          : c.source === "INVENTORY" || c.source === "ORDER_MATERIAL"
            ? ("material" as const)
            : ("cost" as const);
    const kind =
      /fahrt|anfahrt|km|reise/i.test(c.description)
        ? ("travel" as const)
        : /maschine|gerät|miete/i.test(c.description)
          ? ("machine" as const)
          : sourceKind;
    invoiceCandidates.push({
      id: `cost:${c.id}`,
      kind,
      costId: c.id,
      orderId: c.orderId,
      materialLineId: null,
      orderServiceId: null,
      timeEntryId: null,
      label: c.description,
      categoryLabel: PROJECT_COST_SOURCE_LABELS[c.source as keyof typeof PROJECT_COST_SOURCE_LABELS] ?? "Kosten",
      netAmount: c.netAmount,
      selectedByDefault: !c.alreadyBilled,
      alreadyBilled: c.alreadyBilled,
      disabled: false,
      warning: c.alreadyBilled
        ? "Diese Kostenposition wurde bereits abgerechnet."
        : null,
    });
  }

  for (const o of project.orders) {
    const inv = orderInvoiceStatus(o);
    const alreadyBilled = inv.key === "INVOICED";
    invoiceCandidates.push({
      id: `order:${o.id}`,
      kind: "order",
      costId: null,
      orderId: o.id,
      materialLineId: null,
      orderServiceId: null,
      timeEntryId: null,
      label: `${o.orderNumber}${o.title ? ` · ${o.title}` : ""} (gesamter Auftrag)`,
      categoryLabel: "Auftrag",
      netAmount: 0,
      selectedByDefault: !alreadyBilled,
      alreadyBilled,
      disabled: false,
      warning: alreadyBilled
        ? "Dieser Auftrag wurde bereits abgerechnet. Bitte prüfe, ob er erneut in die Projekt-Abschlussrechnung übernommen werden soll."
        : null,
    });

    for (const os of o.services) {
      const label = os.service?.name ?? os.customName ?? "Leistung";
      const qty = os.quantity && os.quantity > 0 ? os.quantity : 1;
      let net = 0;
      if (os.unitPriceCents != null) {
        net = (os.unitPriceCents / 100) * qty;
      } else if (os.service) {
        net = Math.max((os.service.durationMinutes / 60) * qty, 0.25) * hourlyRate;
      } else {
        net = qty * hourlyRate;
      }
      invoiceCandidates.push({
        id: `service:${os.id}`,
        kind: "service",
        costId: null,
        orderId: o.id,
        materialLineId: null,
        orderServiceId: os.id,
        timeEntryId: null,
        label: `${o.orderNumber}: ${label}`,
        categoryLabel: "Leistung",
        netAmount: net,
        selectedByDefault: false,
        alreadyBilled,
        disabled: false,
        warning: alreadyBilled
          ? "Dieser Auftrag wurde bereits abgerechnet. Bitte prüfe, ob er erneut übernommen werden soll."
          : null,
      });
    }

    for (const line of o.materialLines.filter((l) => !l.isTool)) {
      invoiceCandidates.push({
        id: `material:${line.id}`,
        kind: "material",
        costId: null,
        orderId: o.id,
        materialLineId: line.id,
        orderServiceId: null,
        timeEntryId: null,
        label: `${o.orderNumber}: ${line.name}`,
        categoryLabel: "Material",
        netAmount: materialLineNet(line),
        selectedByDefault: false,
        alreadyBilled,
        disabled: false,
        warning: alreadyBilled
          ? "Dieser Auftrag wurde bereits abgerechnet. Bitte prüfe, ob er erneut übernommen werden soll."
          : null,
      });
    }

    for (const te of o.timeEntries.filter((e) => e.endTime && e.status !== "OPEN")) {
      const hours = timeEntryHours(te);
      if (hours <= 0) continue;
      const name = `${te.employee.user.firstName} ${te.employee.user.lastName}`.trim();
      invoiceCandidates.push({
        id: `time:${te.id}`,
        kind: "time",
        costId: null,
        orderId: o.id,
        materialLineId: null,
        orderServiceId: null,
        timeEntryId: te.id,
        label: `${o.orderNumber}: Arbeitszeit ${name} (${hours.toFixed(2)} h)`,
        categoryLabel: "Arbeitszeit",
        netAmount: hours * hourlyRate,
        selectedByDefault: false,
        alreadyBilled,
        disabled: false,
        warning: alreadyBilled
          ? "Dieser Auftrag wurde bereits abgerechnet. Bitte prüfe, ob er erneut übernommen werden soll."
          : null,
      });
    }
  }

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
    orders: project.orders.map((o) => {
      const inv = orderInvoiceStatus(o);
      const materialNet = o.materialLines
        .filter((l) => !l.isTool)
        .reduce((s, l) => s + materialLineNet(l), 0);
      const hours = o.timeEntries.reduce((s, e) => s + timeEntryHours(e), 0);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        title: o.title,
        status: o.status,
        statusLabel: ORDER_STATUS_LABELS[o.status] ?? o.status,
        createdAt: o.createdAt.toISOString(),
        scheduledStart: o.scheduledStart?.toISOString() ?? null,
        customerName: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
        materialCount: o.materialLines.filter((l) => !l.isTool).length,
        materialNet,
        workHours: Math.round(hours * 100) / 100,
        invoiceStatus: inv.key,
        invoiceStatusLabel: inv.label,
      };
    }),
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
      billedNet: billedCosts.reduce((s, c) => s + c.netAmount, 0),
      billedCount: billedCosts.length,
      openBillableNet: openBillable.reduce((s, c) => s + c.netAmount, 0),
      openBillableCount: openBillable.length,
      invoiceGross,
      invoicePaid: paidFromInvoices,
      invoiceOpen: openFromInvoices,
    },
    invoiceCandidates,
    existingCalculations: project.calculations.map((c) => {
      const snap = (c.snapshotJson ?? null) as {
        projectClosingInvoice?: boolean;
        includedOrderIds?: string[];
        orderLabels?: string[];
        lineCount?: number;
      } | null;
      const orderLabels =
        snap?.orderLabels ??
        (snap?.includedOrderIds
          ? snap.includedOrderIds
              .map((oid) => {
                const o = project.orders.find((x) => x.id === oid);
                return o
                  ? o.title?.trim()
                    ? `${o.orderNumber} · ${o.title.trim()}`
                    : o.orderNumber
                  : null;
              })
              .filter((x): x is string => Boolean(x))
          : []);
      return {
        id: c.id,
        title: c.title,
        status: c.status,
        netSalesPrice: c.netSalesPrice,
        vatAmount: c.vatAmount,
        grossSalesPrice: c.grossSalesPrice,
        updatedAt: c.updatedAt.toISOString(),
        invoiceNumber: c.documents[0]?.documentNumber ?? null,
        invoiceStatus: c.documents[0]?.status ?? null,
        issueDate:
          c.documents[0]?.issueDate?.toISOString?.() ??
          c.documents[0]?.issueDate ??
          null,
        isProjectClosing: Boolean(snap?.projectClosingInvoice),
        includedOrderLabels: orderLabels,
        lineCount: snap?.lineCount ?? null,
      };
    }),
  };
}
