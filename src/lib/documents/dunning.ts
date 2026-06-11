import { prisma } from "@/lib/prisma";
import { buildDocumentPdf } from "@/lib/documents/build-document-pdf";
import type { DocumentSnapshot } from "@/lib/documents/snapshot";
import { sendNotification, applyTemplate } from "@/lib/notifications";
import { createAuditLog } from "@/lib/audit";
import { getTenantUserIdsByPermission } from "@/lib/jobs/recipients";
import { getOrCreateNotificationSettings } from "@/lib/notification-settings";

export const DUNNING_LEVEL_LABEL: Record<number, string> = {
  1: "Zahlungserinnerung",
  2: "1. Mahnung",
  3: "2. Mahnung",
};
export const DUNNING_LEVEL_FEE: Record<number, number> = { 1: 0, 2: 5, 3: 10 };
export const DUNNING_LEVEL_DAYS: Record<number, number> = { 1: 7, 2: 7, 3: 5 };

function euro(n: number): string {
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export interface DunningResult {
  ok: boolean;
  error?: string;
  level?: number;
  label?: string;
  feeAmount?: number;
  dueDate?: string;
  sent?: boolean;
  id?: string;
}

/**
 * Erstellt die naechste Mahnstufe fuer eine Rechnung (Zahlungserinnerung, 1./2. Mahnung),
 * versendet sie best effort per E-Mail mit Rechnungs-PDF und legt eine DunningNotice +
 * Audit-Log + In-App-Benachrichtigung an. Wird von der manuellen Route und vom Mahnlauf-Job genutzt.
 */
export async function createDunningForDocument(opts: {
  tenantId: string;
  documentId: string;
  userId?: string | null;
  ipAddress?: string;
  dueInDaysOverride?: number;
}): Promise<DunningResult> {
  const { tenantId, documentId } = opts;

  const doc = await prisma.calculationDocument.findFirst({
    where: { id: documentId, calculation: { tenantId } },
    include: {
      calculation: { include: { customer: true } },
      dunningNotices: true,
    },
  });
  if (!doc) return { ok: false, error: "Dokument nicht gefunden" };
  if (doc.documentType !== "INVOICE") return { ok: false, error: "Nur Rechnungen können gemahnt werden" };
  if (doc.status === "STORNIERT") return { ok: false, error: "Stornierte Rechnungen können nicht gemahnt werden" };
  if (doc.status === "BEZAHLT") return { ok: false, error: "Rechnung ist bereits bezahlt" };

  const level = Math.min(3, doc.dunningNotices.length + 1);
  const fee = DUNNING_LEVEL_FEE[level];
  const dueInDays = opts.dueInDaysOverride ?? DUNNING_LEVEL_DAYS[level];
  const dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);
  const open = Math.max(0, doc.grossAmount - doc.paidAmount);

  const snapshot = doc.dataSnapshotJson as unknown as DocumentSnapshot | null;
  const customerName = snapshot?.calc.customer
    ? `${snapshot.calc.customer.firstName} ${snapshot.calc.customer.lastName}`
    : `${doc.calculation.customer?.firstName ?? ""} ${doc.calculation.customer?.lastName ?? ""}`.trim();
  const companyName = snapshot?.company.companyName ?? "";

  const label = DUNNING_LEVEL_LABEL[level];
  const settings = await getOrCreateNotificationSettings(tenantId);
  const defaultBody =
    `${customerName ? `Sehr geehrte/r ${customerName},` : "Sehr geehrte Damen und Herren,"}\n\n` +
    `zu unserer Rechnung ${doc.documentNumber} konnten wir bisher keinen vollständigen Zahlungseingang feststellen.\n\n` +
    `Offener Betrag: ${euro(open)}\n` +
    (fee > 0 ? `Mahngebühr: ${euro(fee)}\nZu zahlen gesamt: ${euro(open + fee)}\n` : "") +
    `\nWir bitten Sie, den offenen Betrag bis zum ${dueDate.toLocaleDateString("de-DE")} zu begleichen.\n\n` +
    (companyName ? `Mit freundlichen Grüßen\n${companyName}` : "Mit freundlichen Grüßen");
  const body = settings.dunningEmailTemplate
    ? applyTemplate(settings.dunningEmailTemplate, {
        kunde: customerName,
        rechnungsnummer: doc.documentNumber,
        betrag: euro(open),
        gebuehr: euro(fee),
        faelligkeit: dueDate.toLocaleDateString("de-DE"),
        stufe: label,
        firmenname: companyName,
      })
    : defaultBody;

  const email = snapshot?.calc.customer?.email || doc.calculation.customer?.email || null;
  const inAppUserIds = await getTenantUserIdsByPermission(tenantId, "invoices.read");

  let sentAt: Date | null = null;
  if (email && snapshot) {
    const pdf = await buildDocumentPdf(snapshot);
    const sent = await sendNotification({
      tenantId,
      type: "MAHNUNG",
      channel: "EMAIL",
      recipient: email,
      subject: `${label} zu Rechnung ${doc.documentNumber}`,
      body,
      metadata: { documentId: doc.id, level },
      attachments: [
        { filename: `${doc.documentNumber}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" },
      ],
      inAppUserIds,
      inAppTitle: `${label}: ${doc.documentNumber}`,
      inAppLink: "/dashboard/rechnungen",
    });
    if (sent) sentAt = new Date();
  } else if (inAppUserIds.length) {
    await sendNotification({
      tenantId,
      type: "MAHNUNG",
      channel: "IN_APP",
      recipient: "intern",
      subject: `${label} fällig: ${doc.documentNumber}`,
      body,
      metadata: { documentId: doc.id, level },
      inAppUserIds,
      inAppTitle: `${label} fällig: ${doc.documentNumber}`,
      inAppLink: "/dashboard/rechnungen",
    });
  }

  const notice = await prisma.dunningNotice.create({
    data: {
      tenantId,
      documentId: doc.id,
      level,
      feeAmount: fee,
      dueDate,
      sentAt,
      note: label,
      createdById: opts.userId ?? null,
    },
  });

  await createAuditLog({
    tenantId,
    userId: opts.userId ?? null,
    entityType: "CalculationDocument",
    entityId: doc.id,
    action: "DUNNING_CREATED",
    newValues: { level, feeAmount: fee, sent: !!sentAt },
    ipAddress: opts.ipAddress,
  });

  return {
    ok: true,
    level,
    label,
    feeAmount: fee,
    dueDate: dueDate.toISOString(),
    sent: !!sentAt,
    id: notice.id,
  };
}
