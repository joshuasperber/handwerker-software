"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">
              Dashboard konnte nicht geladen werden
            </h2>
            <p className="text-sm text-muted-foreground">
              Beim Laden dieser Seite ist ein Fehler aufgetreten. Bitte
              versuche es erneut.
            </p>
          </div>
          <Button onClick={reset} variant="outline">
            <RefreshCw className="h-4 w-4" />
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
