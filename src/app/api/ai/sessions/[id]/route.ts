import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("ai.chat");
  if (auth instanceof Response) return auth;

  const { id } = await params;

  const session = await prisma.aiChatSession.findFirst({
    where: { id, tenantId: auth.tenantId, userId: auth.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) return apiError("Chat nicht gefunden", 404);

  return apiSuccess({
    id: session.id,
    title: session.title,
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      metadata: m.metadata,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("ai.chat");
  if (auth instanceof Response) return auth;

  const { id } = await params;

  const session = await prisma.aiChatSession.findFirst({
    where: { id, tenantId: auth.tenantId, userId: auth.id },
  });

  if (!session) return apiError("Chat nicht gefunden", 404);

  await prisma.aiChatSession.delete({ where: { id } });

  return apiSuccess({ deleted: true });
}
