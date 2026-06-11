import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { createDunningForDocument } from "@/lib/documents/dunning";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const result = await createDunningForDocument({
    tenantId: auth.tenantId,
    documentId: id,
    userId: auth.id,
    ipAddress: getClientIp(request),
  });

  if (!result.ok) return apiError(result.error ?? "Mahnung fehlgeschlagen", 400);

  return apiSuccess(
    {
      level: result.level,
      label: result.label,
      feeAmount: result.feeAmount,
      dueDate: result.dueDate,
      sent: result.sent,
      id: result.id,
    },
    201
  );
}
