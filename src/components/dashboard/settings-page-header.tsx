import { SETTINGS_PAGE_INTROS } from "@/lib/settings-nav";
import { cn } from "@/lib/utils";

export function SettingsPageHeader({
  href,
  title,
  description,
  className,
}: {
  href?: string;
  title?: string;
  description?: string;
  className?: string;
}) {
  const intro = href ? SETTINGS_PAGE_INTROS[href] : undefined;
  const heading = title ?? intro?.title ?? "";
  const text = description ?? intro?.description ?? "";

  return (
    <header className={cn("mb-6 max-w-3xl", className)}>
      <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
      {text ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p> : null}
    </header>
  );
}
