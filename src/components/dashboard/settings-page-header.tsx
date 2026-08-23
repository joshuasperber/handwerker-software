import { InfoButton } from "@/components/ui/info-button";
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
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        {heading}
        {text ? (
          <InfoButton title={heading} ariaLabel={`Info zu ${heading}`}>
            <p>{text}</p>
          </InfoButton>
        ) : null}
      </h1>
    </header>
  );
}
