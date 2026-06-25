import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";
import { isValidPhotoCategory } from "@/lib/files";
import { uploadOrderFiles, listOrderPhotoFiles } from "@/lib/orders/order-files";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access && access.error) return access.error;

  const formData = await request.formData();
  const result = await uploadOrderFiles({
    orderId,
    userId: auth.id,
    formData,
    resolveCategory: (raw) => (isValidPhotoCategory(raw) ? raw : "KUNDENFOTO"),
  });

  if (result instanceof Response) return result;
  return apiSuccess(result, 201);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access && access.error) return access.error;

  const { searchParams } = new URL(request.url);
  const withUrls = await listOrderPhotoFiles({
    orderId,
    phaseFilter: searchParams.get("orderPhaseId"),
  });

  return apiSuccess(withUrls);
}
