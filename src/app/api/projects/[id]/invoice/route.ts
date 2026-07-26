import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { createProjectInvoiceCalculation } from "@/lib/projects/invoice";

const schema = z.object({
  title: z.string().max(200).optional(),
  costIds: z.array(z.string()).optional(),
  orderIds: z.array(z.string()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const { id: projectId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  try {
    const calc = await createProjectInvoiceCalculation({
      tenantId: auth.tenantId,
      projectId,
      title: parsed.data.title,
      costIds: parsed.data.costIds,
      orderIds: parsed.data.orderIds,
    });
    return apiSuccess(calc, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rechnung konnte nicht vorbereitet werden";
    const status = message.includes("nicht gefunden")
      ? 404
      : message.includes("auswählen")
        ? 400
        : 500;
    if (status === 500) console.error("[projects/invoice]", err);
    return apiError(message, status);
  }
}
