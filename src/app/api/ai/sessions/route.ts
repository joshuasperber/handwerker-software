import { requireAuth, apiSuccess } from "@/lib/api";
import { parseBody } from "@/lib/api-body";
import { createSessionSchema } from "@/lib/ai/schemas";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAuth("ai.chat");
  if (auth instanceof Response) return auth;

  const sessions = await prisma.aiChatSession.findMany({
    where: { tenantId: auth.tenantId, userId: auth.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return apiSuccess(
    sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt.toISOString(),
      preview: s.messages[0]?.content.slice(0, 120) ?? "",
    }))
  );
}

export async function POST(request: Request) {
  const auth = await requireAuth("ai.chat");
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, createSessionSchema);
  if (body instanceof Response) return body;

  const session = await prisma.aiChatSession.create({
    data: {
      tenantId: auth.tenantId,
      userId: auth.id,
      title: body.title ?? "Neuer Chat",
    },
  });

  return apiSuccess({ id: session.id, title: session.title });
}
