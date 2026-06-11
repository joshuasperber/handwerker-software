import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Einheitlicher „Hinzufügen“-Button für alle Reiter.
 *
 * Sorgt für gleiche Größe, gleiche Abstände, gleiche Positionierung und einen
 * einheitlichen Stil des Plus-Symbols – auf Desktop und Mobile. Auf kleinen
 * Bildschirmen ist der Button bewusst kompakter.
 *
 * Für Navigations-Aktionen kann `href` gesetzt werden; dann wird ein Link
 * gerendert (statt zusätzlich ein <Link> außenherum zu wickeln).
 */
export function AddButton({
  className,
  children,
  href,
  iconOnlyOnMobile = false,
  ...props
}: React.ComponentProps<typeof Button> & {
  /** Optional: rendert den Button als Navigations-Link. */
  href?: string;
  /** Versteckt das Text-Label auf sehr kleinen Bildschirmen (nur Icon). */
  iconOnlyOnMobile?: boolean;
}) {
  const content = (
    <>
      <Plus className="size-4 shrink-0" aria-hidden="true" />
      {children != null && (
        <span className={cn(iconOnlyOnMobile && "sr-only sm:not-sr-only")}>
          {children}
        </span>
      )}
    </>
  );

  const classes = cn("shrink-0 sm:h-10 sm:px-5 sm:text-sm", className);

  if (href) {
    return (
      <Button asChild variant="action" size="sm" className={classes} {...props}>
        <Link href={href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button variant="action" size="sm" className={classes} {...props}>
      {content}
    </Button>
  );
}
