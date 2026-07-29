import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { createProjectInvoiceCalculation } from "@/lib/projects/invoice";

const schema = z.object({
  title: z.string().max(200).optional(),
  mode: z.enum(["aggregate", "per_order"]).optional(),
  preview: z.boolean().optional(),
  includeAlreadyBilled: z.boolean().optional(),
  costIds: z.array(z.string()).optional(),
  orderIds: z.array(z.string()).optional(),
  materialLineIds: z.array(z.string()).optional(),
  orderServiceIds: z.array(z.string()).optional(),
  timeEntryIds: z.array(z.string()).optional(),
  excludedSourceKeys: z.array(z.string()).optional(),
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
    const result = await createProjectInvoiceCalculation({
      tenantId: auth.tenantId,
      projectId,
      title: parsed.data.title,
      mode: parsed.data.mode,
      preview: parsed.data.preview === true,
      includeAlreadyBilled: parsed.data.includeAlreadyBilled === true,
      costIds: parsed.data.costIds,
      orderIds: parsed.data.orderIds,
      materialLineIds: parsed.data.materialLineIds,
      orderServiceIds: parsed.data.orderServiceIds,
      timeEntryIds: parsed.data.timeEntryIds,
      excludedSourceKeys: parsed.data.excludedSourceKeys,
    });

    if (parsed.data.preview) {
      return apiSuccess({
        preview: true,
        mode: result.mode,
        draft: result.draft,
        warnings: result.warnings,
      });
    }

    return apiSuccess(
      {
        ...result.primary,
        mode: result.mode,
        calculations: result.calculations,
        draft: result.draft
          ? {
              groups: result.draft.groups,
              netTotal: result.draft.netTotal,
              vatAmount: result.draft.vatAmount,
              grossTotal: result.draft.grossTotal,
              lineCount: result.draft.lines.length,
            }
          : null,
        warnings: result.warnings,
      },
      201
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rechnung konnte nicht vorbereitet werden";
    const status = message.includes("nicht gefunden")
      ? 404
      : message.includes("auswählen") || message.includes("abgerechnet")
        ? 400
        : 500;
    if (status === 500) console.error("[projects/invoice]", err);
    return apiError(message, status);
  }
}
