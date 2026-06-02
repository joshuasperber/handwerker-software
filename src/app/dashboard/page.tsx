import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
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
          <Link
            href="/dashboard/auftraege/neu"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#e87722] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#d06818] sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Neuer Auftrag
          </Link>
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
