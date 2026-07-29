"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Ausgaben laufen über die Finanzübersicht als flexibles Fenster. */
export default function AusgabenRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/finanzuebersicht?view=ausgaben");
  }, [router]);

  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      Weiterleitung zur Finanzübersicht…
    </div>
  );
}
