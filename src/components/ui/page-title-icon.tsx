import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageTitleIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#0b6268]/10 text-[#0b6268]",
        className
      )}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}
