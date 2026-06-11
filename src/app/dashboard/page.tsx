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
  const data = await getDashboardAnalytics(tenantId);
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
