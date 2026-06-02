import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth("services.read");
  if (auth instanceof Response) return auth;

  const services = await prisma.service.findMany({
    where: { tenantId: auth.tenantId },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      qualifications: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  return apiSuccess(services);
}

export async function POST(request: Request) {
  const auth = await requireAuth("services.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();

  const service = await prisma.service.create({
    data: {
      tenantId: auth.tenantId,
      name: body.name,
      description: body.description,
      durationMinutes: body.durationMinutes,
      bufferMinutes: body.bufferMinutes ?? 0,
      priceCents: body.priceCents,
    },
  });

  return apiSuccess(service, 201);
}
