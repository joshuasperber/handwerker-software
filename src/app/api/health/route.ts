import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count();
    return apiSuccess({
      ok: true,
      database: "connected",
      users: userCount,
      hint:
        userCount === 0
          ? "Datenbank leer – bitte „npm run db:seed“ ausführen."
          : undefined,
    });
  } catch {
    return apiError(
      "Datenbank nicht erreichbar. Docker starten, dann „npm run setup“.",
      503
    );
  }
}
