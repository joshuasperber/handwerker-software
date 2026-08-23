import { prisma } from "@/lib/prisma";

export async function resolveInvestmentLinks(
  tenantId: string,
  input: {
    machineId?: string | null;
    articleId?: string | null;
    projectId?: string | null;
  }
): Promise<{ machineId: string | null; articleId: string | null; projectId: string | null } | { error: string }> {
  const machineId = input.machineId ?? null;
  const articleId = input.articleId ?? null;
  const projectId = input.projectId ?? null;

  if (machineId) {
    const found = await prisma.machine.findFirst({
      where: { id: machineId, tenantId },
      select: { id: true },
    });
    if (!found) return { error: "Maschine nicht gefunden" };
  }
  if (articleId) {
    const found = await prisma.article.findFirst({
      where: { id: articleId, tenantId },
      select: { id: true },
    });
    if (!found) return { error: "Artikel nicht gefunden" };
  }
  if (projectId) {
    const found = await prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    });
    if (!found) return { error: "Projekt nicht gefunden" };
  }

  return { machineId, articleId, projectId };
}
