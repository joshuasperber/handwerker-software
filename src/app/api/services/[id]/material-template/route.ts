import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("services.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const templates = await prisma.serviceMaterialTemplate.findMany({
    where: {
      serviceId: id,
      service: { tenantId: auth.tenantId },
    },
    include: { article: true },
    orderBy: { sortOrder: "asc" },
  });

  return apiSuccess(
    templates.map((t) => ({
      id: t.id,
      name: t.article?.name ?? t.name,
      defaultQuantity: t.defaultQuantity,
      unit: t.unit,
      isReservable: t.isReservable,
      isTool: t.isTool,
      articleId: t.articleId,
    }))
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("services.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const service = await prisma.service.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!service) return apiError("Leistung nicht gefunden", 404);

  const isTool = body.isTool === true;
  if (!isTool && !body.articleId) {
    return apiError("Materialpositionen müssen einem Inventar-Artikel zugeordnet sein. Für Werkzeuge 'isTool' aktivieren.", 400);
  }

  let articleName = body.name;
  let unit = body.unit ?? "Stk";
  if (body.articleId) {
    const article = await prisma.article.findFirst({
      where: { id: body.articleId, tenantId: auth.tenantId, isActive: true },
    });
    if (!article) return apiError("Artikel nicht im Inventar gefunden", 404);
    articleName = article.name;
    unit = article.unit;
  }

  const template = await prisma.serviceMaterialTemplate.create({
    data: {
      serviceId: id,
      articleId: isTool ? undefined : body.articleId,
      name: articleName ?? body.name,
      defaultQuantity: Number(body.defaultQuantity ?? 1),
      unit,
      isReservable: isTool ? false : body.isReservable !== false,
      isTool,
    },
  });

  return apiSuccess(template, 201);
}
