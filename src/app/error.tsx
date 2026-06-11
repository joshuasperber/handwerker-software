"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unerwarteter Fehler:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-900/10 sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">
          Es ist ein Fehler aufgetreten.
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Bitte laden Sie die Seite neu.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset} variant="primary">
            <RefreshCw className="h-4 w-4" />
            Erneut versuchen
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline">
            Seite neu laden
          </Button>
        </div>
      </div>
    </div>
  );
}
