import { Suspense } from "react";
import { AddButton } from "@/components/ui/add-button";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getDashboardAnalytics } from "@/lib/dashboard/analytics";
import { MonteurDashboardOverview } from "@/components/dashboard/monteur-overview";
import { DashboardView } from "@/components/dashboard/analytics/dashboard-view";
import { DashboardSkeleton } from "@/components/dashboard/analytics/dashboard-skeleton";

export const dynamic = "force-dynamic";

async function DashboardData({ tenantId }: { tenantId: string }) {
  let data: Awaited<ReturnType<typeof getDashboardAnalytics>> | null = null;
  try {
    data = await getDashboardAnalytics(tenantId);
  } catch (error) {
    console.error("[dashboard] analytics failed:", error);
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Auswertungen vorübergehend nicht verfügbar</p>
        <p className="mt-1 text-amber-800">
          Die Kennzahlen konnten nicht geladen werden. Aufträge und andere Bereiche
          bleiben über die Navigation erreichbar.
        </p>
      </div>
    );
  }

  return <DashboardView data={data} />;
}

export default async function DashboardPage() {
  const session = await getSession();

  if (session?.role === "MONTEUR") {
    return <MonteurDashboardOverview />;
  }

  const canCreateOrder = session
    ? hasPermission(session.role, "orders.write")
    : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Überblick über Umsatz, Aufträge, Termine und Rechnungen
          </p>
        </div>
        {canCreateOrder && (
          <AddButton href="/dashboard/auftraege/neu" className="w-full sm:w-auto">
            Neuer Auftrag
          </AddButton>
        )}
      </div>

      {session ? (
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardData tenantId={session.tenantId} />
        </Suspense>
      ) : (
        <DashboardSkeleton />
      )}
    </div>
  );
}
