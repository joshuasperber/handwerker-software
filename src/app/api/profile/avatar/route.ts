import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const user = await prisma.user.findFirst({
    where: { id: auth.id, tenantId: auth.tenantId },
    select: { avatarUrl: true },
  });

  if (!user?.avatarUrl?.startsWith("data:")) {
    return new Response(null, { status: 404 });
  }

  const parsed = parseDataUrl(user.avatarUrl);
  if (!parsed) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(parsed.buffer), {
    headers: {
      "Content-Type": parsed.mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
