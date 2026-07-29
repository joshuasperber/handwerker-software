import { Suspense } from "react";
import { StundenzettelView } from "@/components/monteur/stundenzettel-view";

export default function MonteurStundenzettelPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Stundenzettel wird geladen …</div>}>
      <StundenzettelView title="Stundenzettel" />
    </Suspense>
  );
}
