import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-900/10 sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Compass className="h-6 w-6" />
        </div>
        <p className="mt-4 text-4xl font-bold text-slate-900">404</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">
          Seite nicht gefunden
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Die aufgerufene Seite existiert nicht oder wurde verschoben.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="primary">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Zur Startseite
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
