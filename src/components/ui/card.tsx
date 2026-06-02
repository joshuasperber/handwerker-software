import * as React from "react"

import { cn } from "@/lib/utils"

const CARD_BASE =
  "group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl"

/**
 * Erkennt, ob die Karte mit den Unterkomponenten (CardHeader/CardContent/…)
 * zusammengesetzt ist. In diesem Fall bringen die Unterkomponenten ihr eigenes
 * horizontales Padding mit und die Karte selbst bleibt randlos.
 */
function usesComposedLayout(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some(
    (child) =>
      React.isValidElement(child) &&
      (child.type === CardHeader ||
        child.type === CardContent ||
        child.type === CardFooter)
  )
}

function Card({
  className,
  size = "default",
  title,
  action,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  /** Optionale Überschrift – rendert einen Karten-Kopf inkl. Innenabstand. */
  title?: React.ReactNode
  /** Optionale Aktion oben rechts (z. B. Button) neben dem Titel. */
  action?: React.ReactNode
}) {
  const composed = usesComposedLayout(children)

  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        CARD_BASE,
        // Zusammengesetzte Karten paddeln über ihre Unterkomponenten,
        // einfache Karten bekommen großzügigen Innenabstand (luftiger Look).
        composed
          ? "py-4 group-data-[size=sm]/card:py-3"
          : "px-5 py-5 data-[size=sm]:px-4 data-[size=sm]:py-4",
        className
      )}
      {...props}
    >
      {title != null && (
        <div className="flex items-start justify-between gap-3 -mt-0.5">
          <h3 className="font-heading text-base leading-snug font-semibold text-card-foreground">
            {title}
          </h3>
          {action != null && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-5 group-data-[size=sm]/card:px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5 group-data-[size=sm]/card:px-4", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-5 group-data-[size=sm]/card:p-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
