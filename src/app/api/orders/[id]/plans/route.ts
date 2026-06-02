import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { getSignedDownloadUrl } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;

  const plans = await prisma.fileUpload.findMany({
    where: {
      orderId,
      order: { tenantId: auth.tenantId },
      category: { in: ["PLAN", "GRUNDRISS"] },
    },
    include: {
      planMarkers: { include: { article: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const withUrls = await Promise.all(
    plans.map(async (p) => ({
      ...p,
      url: await getSignedDownloadUrl(p.storageKey).catch(() => null),
    }))
  );

  return apiSuccess(withUrls);
}
