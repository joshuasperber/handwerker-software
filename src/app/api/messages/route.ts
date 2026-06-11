import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { notifyNewMessage } from "@/lib/notifications";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth("messages.read");
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const category = searchParams.get("category");
    const box = searchParams.get("box"); // "inbox" | "sent" | null

    const isGuest = auth.role === "GAST";

    const where: Prisma.MessageWhereInput = {
      tenantId: auth.tenantId,
      ...(orderId ? { orderId } : {}),
      ...(category ? { category } : {}),
      ...(box === "inbox" ? { recipientUserId: auth.id } : {}),
      ...(box === "sent" ? { senderId: auth.id } : {}),
      // Gäste sehen ausschließlich Nachrichten, die sie betreffen (Datenschutz).
      ...(isGuest ? { OR: [{ recipientUserId: auth.id }, { senderId: auth.id }] } : {}),
    };

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: { select: { firstName: true, lastName: true } },
        recipientUser: { select: { firstName: true, lastName: true } },
        order: { select: { id: true, orderNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Eingang öffnen = an mich gerichtete Nachrichten als gelesen markieren.
    if (box === "inbox" || isGuest) {
      await prisma.message.updateMany({
        where: { tenantId: auth.tenantId, recipientUserId: auth.id, readAt: null },
        data: { readAt: new Date() },
      });
    }

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
    const recipientUserId = (body.recipientUserId ?? "").trim() || null;
    const isDirect = Boolean(recipientUserId);

    // Direktnachricht: Empfänger muss zum Betrieb gehören.
    let recipientEmail: string | null = null;
    if (recipientUserId) {
      const recipient = await prisma.user.findFirst({
        where: { id: recipientUserId, tenantId: auth.tenantId, isActive: true },
        select: { email: true },
      });
      if (!recipient) return apiError("Empfänger nicht gefunden", 404);
      recipientEmail = recipient.email;
    }

    if (!body.body || !String(body.body).trim()) {
      return apiError("Nachrichtentext fehlt", 400);
    }

    // Gäste dürfen nur Direktnachrichten an Betriebsmitglieder senden.
    if (auth.role === "GAST" && !isDirect) {
      return apiError("Bitte einen Empfänger auswählen", 400);
    }

    const message = await prisma.message.create({
      data: {
        tenantId: auth.tenantId,
        orderId: body.orderId || null,
        senderId: auth.id,
        recipientUserId,
        recipient: isDirect ? null : body.recipient ?? "BUERO",
        subject: body.subject || null,
        body: String(body.body).trim(),
        category: body.category ?? (isDirect ? "DIRECT" : "GENERAL"),
        status: isDirect ? "SENT" : "OPEN",
        isInternal: isDirect ? false : body.isInternal ?? true,
      },
      include: {
        sender: { select: { firstName: true, lastName: true } },
        recipientUser: { select: { firstName: true, lastName: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    });

    if (recipientEmail) {
      await notifyNewMessage(
        auth.tenantId,
        recipientEmail,
        `${auth.firstName} ${auth.lastName}`,
        body.subject || null
      );
    }

    return apiSuccess(message, 201);
  } catch (err) {
    console.error("[POST /api/messages]", err);
    return apiError("Nachricht konnte nicht gesendet werden", 500);
  }
}
