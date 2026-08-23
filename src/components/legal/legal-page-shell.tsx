import type { ReactNode } from "react";
import { LegalFooter } from "@/components/legal/legal-footer";
import { PublicSiteHeader } from "@/components/auth/public-site-header";

export async function LegalPageShell({
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
      <PublicSiteHeader narrow />

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
