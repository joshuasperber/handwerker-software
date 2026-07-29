import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { StundenzettelView } from "@/components/monteur/stundenzettel-view";

export default async function DashboardStundenzettelPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.role, "monteur.own")) redirect("/dashboard");

  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Stundenzettel wird geladen …</div>}>
      <StundenzettelView />
    </Suspense>
  );
}
