import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { notifyNewMessage, createInAppNotification } from "@/lib/notifications";
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
      ...(isGuest ? { OR: [{ recipientUserId: auth.id }, { senderId: auth.id }] } : {}),
    };

    const officeRoles = ["ADMIN", "BUERO", "MEISTER"];

    if (box === "inbox" && !isGuest) {
      if (officeRoles.includes(auth.role)) {
        where.OR = [
          { recipientUserId: auth.id },
          { recipientUserId: null, recipient: { in: ["BUERO", "ALL", "ADMIN"] } },
          { category: "MATERIAL_REQUEST", recipientUserId: null },
        ];
      } else {
        where.recipientUserId = auth.id;
      }
    } else if (box === "sent") {
      where.senderId = auth.id;
    } else if (!isGuest && auth.role === "MONTEUR") {
      // Monteur sieht nur eigene und an ihn gerichtete Nachrichten (nicht alle Betriebsnachrichten).
      where.OR = [{ senderId: auth.id }, { recipientUserId: auth.id }];
    } else if (!isGuest && officeRoles.includes(auth.role) && !category) {
      // Büro ohne Box-Filter: keine fremden Direktnachrichten zwischen Kollegen.
      where.OR = [
        { recipientUserId: auth.id },
        { senderId: auth.id },
        { recipientUserId: null, recipient: { in: ["BUERO", "ALL", "ADMIN"] } },
        { category: "MATERIAL_REQUEST" },
      ];
    }

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

    if (auth.role === "GAST" && body.orderId) {
      const share = await prisma.orderShare.findFirst({
        where: { orderId: body.orderId, sharedWithUserId: auth.id, tenantId: auth.tenantId },
      });
      if (!share) return apiError("Auftrag nicht freigegeben", 403);
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

    // Büro-Nachrichten (z. B. Materialanfrage vom Monteur) → In-App an Admin/Büro/Meister
    const isOfficeBroadcast =
      !recipientUserId &&
      (body.recipient === "BUERO" ||
        message.recipient === "BUERO" ||
        message.category === "MATERIAL_REQUEST");
    if (isOfficeBroadcast) {
      const officeUsers = await prisma.user.findMany({
        where: {
          tenantId: auth.tenantId,
          isActive: true,
          role: { in: ["ADMIN", "BUERO", "MEISTER"] },
        },
        select: { id: true },
      });
      const senderName = `${auth.firstName} ${auth.lastName}`;
      const title =
        message.category === "MATERIAL_REQUEST"
          ? `Materialanfrage von ${senderName}`
          : `Nachricht von ${senderName}`;
      await Promise.all(
        officeUsers.map((u) =>
          createInAppNotification({
            tenantId: auth.tenantId,
            userId: u.id,
            type: "NACHRICHT",
            title,
            body: String(body.body).trim().slice(0, 200),
            link: "/dashboard/nachrichten",
          })
        )
      );
    }

    return apiSuccess(message, 201);
  } catch (err) {
    console.error("[POST /api/messages]", err);
    return apiError("Nachricht konnte nicht gesendet werden", 500);
  }
}
