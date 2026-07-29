import Link from "next/link";

const LINKS = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
] as const;

export function LegalFooter({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <footer
      className={`border-t border-slate-200 bg-white/80 ${compact ? "py-4" : "py-8"} ${className}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center text-sm text-slate-500 sm:flex-row sm:justify-between sm:text-left">
        <p>
          JoMaster · Technische Datenschutzvorbereitung ·{" "}
          <span className="text-slate-400">keine Rechtsberatung</span>
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2" aria-label="Rechtliches">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[#0d5c63] underline-offset-2 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function LegalInlineLinks({ className = "" }: { className?: string }) {
  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500 ${className}`}
      aria-label="Rechtliches"
    >
      {LINKS.map((link, i) => (
        <span key={link.href} className="inline-flex items-center gap-3">
          {i > 0 && <span aria-hidden className="text-slate-300">·</span>}
          <Link href={link.href} className="hover:text-[#0d5c63] hover:underline underline-offset-2">
            {link.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
