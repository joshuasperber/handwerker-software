import type { ReactNode } from "react";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { LegalFooter } from "@/components/legal/legal-footer";

export function LegalPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d5c63] text-white">
              <Wrench className="h-4 w-4" />
            </div>
            <span className="font-bold text-slate-900">JoMaster</span>
          </Link>
          <Link href="/login" className="text-sm text-[#0d5c63] hover:underline">
            Anmelden
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-amber-700">
          Platzhalter — juristisch noch zu prüfen
        </p>
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-2 text-slate-600">{subtitle}</p>}
        <div className="prose prose-slate mt-8 max-w-none space-y-4 text-sm leading-relaxed text-slate-700">
          {children}
        </div>
      </main>

      <LegalFooter compact />
    </div>
  );
}
