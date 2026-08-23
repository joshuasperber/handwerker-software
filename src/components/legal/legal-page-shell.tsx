import type { ReactNode } from "react";
import { LegalFooter } from "@/components/legal/legal-footer";
import { PublicSiteHeader } from "@/components/auth/public-site-header";
import { InfoButton } from "@/components/ui/info-button";

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
        <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900">
          {title}
          {subtitle ? (
            <InfoButton title={title} ariaLabel={`Info zu ${title}`}>
              <p>{subtitle}</p>
            </InfoButton>
          ) : null}
        </h1>
        <div className="prose prose-slate mt-8 max-w-none space-y-4 text-sm leading-relaxed text-slate-700">
          {children}
        </div>
      </main>

      <LegalFooter compact />
    </div>
  );
}
