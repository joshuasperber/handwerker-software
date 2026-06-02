import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth("messages.read");
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const category = searchParams.get("category");

    const messages = await prisma.message.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(orderId ? { orderId } : {}),
        ...(category ? { category } : {}),
      },
      include: { sender: true, order: { select: { id: true, orderNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return apiSuccess(messages);
  } catch (err) {
    console.error("[GET /api/messages]", err);
    return apiError("Nachrichten konnten nicht geladen werden", 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth("messages.write");
    if (auth instanceof Response) return auth;

    const body = await request.json();

    const message = await prisma.message.create({
      data: {
        tenantId: auth.tenantId,
        orderId: body.orderId || null,
        senderId: auth.id,
        recipient: body.recipient ?? "BUERO",
        subject: body.subject,
        body: body.body,
        category: body.category ?? "GENERAL",
        status: "OPEN",
        isInternal: body.isInternal ?? true,
      },
      include: { sender: true, order: { select: { id: true, orderNumber: true } } },
    });

    return apiSuccess(message, 201);
  } catch (err) {
    console.error("[POST /api/messages]", err);
    return apiError("Nachricht konnte nicht gesendet werden", 500);
  }
}
