import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, NO_STORE_HEADERS } from "@/lib/api";

/**
 * Art.-17-Vorbereitung: Prüft, was gelöscht/anonymisiert werden kann
 * und welche Blocker (z. B. Rechnungen) einer Sofortlöschung entgegenstehen.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth("tenant.manage");
  if (auth instanceof Response) return auth;

  const customerId = new URL(request.url).searchParams.get("customerId");
  if (!customerId) return apiError("customerId erforderlich");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: auth.tenantId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      company: true,
      _count: {
        select: {
          orders: true,
          properties: true,
          expenses: true,
        },
      },
    },
  });
  if (!customer) return apiError("Kunde nicht gefunden", 404);

  const [invoiceCount, fileCount, calculationCount] = await Promise.all([
    prisma.calculationDocument.count({
      where: {
        calculation: { tenantId: auth.tenantId, customerId },
      },
    }),
    prisma.fileUpload.count({
      where: {
        order: { customerId, tenantId: auth.tenantId },
      },
    }),
    prisma.calculation.count({
      where: { tenantId: auth.tenantId, customerId },
    }),
  ]);

  const blockers: string[] = [];
  if (customer._count.orders > 0) {
    blockers.push(
      `${customer._count.orders} Auftrag/Aufträge vorhanden — Löschung oft erst nach Anonymisierung/Ablauf von Aufbewahrungsfristen möglich`
    );
  }
  if (invoiceCount > 0) {
    blockers.push(
      `${invoiceCount} Rechnungs-/Angebotsdokument(e) — steuerliche Aufbewahrung prüfen`
    );
  }
  if (calculationCount > 0) {
    blockers.push(`${calculationCount} Kalkulation(en) verknüpft`);
  }

  return apiSuccess(
    {
      customer: {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        email: customer.email,
        company: customer.company,
      },
      counts: {
        orders: customer._count.orders,
        properties: customer._count.properties,
        expenses: customer._count.expenses,
        documents: invoiceCount,
        files: fileCount,
        calculations: calculationCount,
      },
      blockers,
      canHardDelete: blockers.length === 0,
      recommendedSteps: [
        "Rechtliche Aufbewahrungsfristen und Verantwortlichkeit klären",
        "Falls erlaubt: Kundendaten anonymisieren statt physisch löschen",
        "S3-Objekte (Belege/Fotos) gezielt entfernen oder Lifecycle-Policy setzen",
        "Audit-Log-Eintrag zur Löschentscheidung schreiben",
        "Export vorher erstellen (/api/privacy/export?customerId=…)",
      ],
      disclaimer:
        "Technischer Checklist-Endpunkt — ersetzt keine datenschutzrechtliche Freigabe.",
    },
    200,
    NO_STORE_HEADERS
  );
}
