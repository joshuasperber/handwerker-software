import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import {
  avatarStorageKey,
  isDataAvatar,
  isHttpAvatar,
  toAvatarSrc,
} from "@/lib/avatar";
import {
  deleteFile,
  downloadFile,
  isStorageConfigured,
  uploadFile,
} from "@/lib/storage";

const MAX_AVATAR_BYTES = 800_000;
const MAX_DATA_URL_LENGTH = 1_500_000;

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

async function loadUserAvatar(userId: string, tenantId: string) {
  return prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { avatarUrl: true, updatedAt: true },
  });
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const user = await loadUserAvatar(auth.id, auth.tenantId);
  if (!user?.avatarUrl) {
    return new Response(null, { status: 404 });
  }

  const stored = user.avatarUrl;

  if (isDataAvatar(stored)) {
    const parsed = parseDataUrl(stored);
    if (!parsed) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(parsed.buffer), {
      headers: {
        "Content-Type": parsed.mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (isHttpAvatar(stored)) {
    return Response.redirect(stored, 302);
  }

  const buffer = await downloadFile(stored);
  if (!buffer) return new Response(null, { status: 404 });

  const lower = stored.toLowerCase();
  const mime = lower.endsWith(".png")
    ? "image/png"
    : lower.endsWith(".webp")
      ? "image/webp"
      : lower.endsWith(".gif")
        ? "image/gif"
        : "image/jpeg";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/** Profilbild hochladen (multipart `file`) — speichert in S3 oder als Data-URL-Fallback. */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Ungültige Formulardaten", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return apiError("Keine Bilddatei übermittelt", 400);
  }
  if (!file.type.startsWith("image/")) {
    return apiError("Bitte eine Bilddatei (JPG/PNG/…) wählen", 400);
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return apiError("Profilbild ist zu groß (max. ca. 800 KB nach Komprimierung)", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const existing = await loadUserAvatar(auth.id, auth.tenantId);
  const previousKey = avatarStorageKey(existing?.avatarUrl);

  let stored: string;
  if (isStorageConfigured()) {
    try {
      const uploaded = await uploadFile(
        buffer,
        file.name || "avatar.jpg",
        file.type || "image/jpeg",
        `avatars/${auth.tenantId}`
      );
      stored = uploaded.key;
    } catch (err) {
      console.error("[profile/avatar] S3 upload failed", err);
      return apiError(
        "Profilbild konnte nicht im Datei-Speicher abgelegt werden. Bitte später erneut versuchen.",
        500
      );
    }
  } else {
    const mime = file.type || "image/jpeg";
    stored = `data:${mime};base64,${buffer.toString("base64")}`;
    if (stored.length > MAX_DATA_URL_LENGTH) {
      return apiError(
        "Profilbild ist zu groß und Datei-Speicher (S3) ist nicht konfiguriert.",
        400
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: auth.id },
    data: { avatarUrl: stored },
    select: { avatarUrl: true, updatedAt: true },
  });

  if (previousKey && previousKey !== stored) {
    await deleteFile(previousKey).catch(() => {});
  }

  return apiSuccess({
    avatarUrl: toAvatarSrc(updated.avatarUrl, updated.updatedAt),
    hasAvatar: true,
  });
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const existing = await loadUserAvatar(auth.id, auth.tenantId);
  const previousKey = avatarStorageKey(existing?.avatarUrl);

  await prisma.user.update({
    where: { id: auth.id },
    data: { avatarUrl: null },
  });

  if (previousKey) {
    await deleteFile(previousKey).catch(() => {});
  }

  return apiSuccess({ avatarUrl: null, hasAvatar: false });
}
