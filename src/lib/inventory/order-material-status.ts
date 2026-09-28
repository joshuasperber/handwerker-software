import type { MaterialOrderStatus } from "@/generated/prisma/client";

export type MaterialStatusLine = {
  articleId: string | null;
  quantityRequired: number;
};

export function determineMaterialOrderStatus(
  lines: MaterialStatusLine[],
  availableByArticle: ReadonlyMap<string, number>
): MaterialOrderStatus {
  if (lines.length === 0) return "NOT_CHECKED";

  let hasMissing = false;
  let hasPartial = false;

  for (const line of lines) {
    if (!line.articleId) {
      hasPartial = true;
      continue;
    }

    const available = availableByArticle.get(line.articleId) ?? 0;
    if (available >= line.quantityRequired) continue;
    if (available > 0) hasPartial = true;
    else hasMissing = true;
  }

  if (hasMissing) return "MISSING";
  if (hasPartial) return "PARTLY_AVAILABLE";
  return "COMPLETE";
}
