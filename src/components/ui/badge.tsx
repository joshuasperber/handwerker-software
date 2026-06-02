import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * Semantische Farbzuordnung für Status-Badges. Leitidee:
 *  - grün  = offen / aktiv (muss noch erledigt werden)
 *  - gelb  = in Arbeit
 *  - blau  = heute fällig (besondere Aufmerksamkeit)
 *  - grau  = erledigt / abgeschlossen (kein Handlungsbedarf mehr)
 *  - rot   = storniert / Problem
 * Unbekannte Werte fallen auf eine neutrale Darstellung zurück.
 */
const STATUS_GREEN = "bg-green-100 text-green-700"
const STATUS_AMBER = "bg-amber-100 text-amber-700"
const STATUS_BLUE = "bg-blue-100 text-blue-700"
const STATUS_GRAY = "bg-slate-100 text-slate-600"
const STATUS_RED = "bg-red-100 text-red-700"

const statusBadgeColors: Record<string, string> = {
  // Auftragsstatus (OrderStatus) – offen (grün) → in Arbeit (gelb) → erledigt (grau)
  NEUE_ANFRAGE: STATUS_GREEN,
  TERMIN_GEBUCHT: STATUS_GREEN,
  EINGEPLANT: STATUS_GREEN,
  UNTERWEGS: STATUS_AMBER,
  IN_ARBEIT: STATUS_AMBER,
  ABGESCHLOSSEN: STATUS_GRAY,
  ABRECHNUNGSBEREIT: STATUS_GRAY,
  ABGERECHNET: STATUS_GRAY,
  STORNIERT: STATUS_RED,
  // Zusatzmarkierungen, die zusätzlich zum Status angezeigt werden
  HEUTE: STATUS_BLUE,
  UEBERFAELLIG: STATUS_RED,
  // Terminstatus (AppointmentStatus)
  GEPLANT: STATUS_GREEN,
  ANGEKOMMEN: STATUS_AMBER,
  // Mitarbeiter-Status (Disposition)
  IM_TERMIN: STATUS_BLUE,
  KRANK: STATUS_RED,
  // Bestellstatus (PurchaseOrder)
  DRAFT: STATUS_GRAY,
  ORDERED: STATUS_GREEN,
  CONFIRMED: STATUS_GREEN,
  PARTLY_DELIVERED: STATUS_AMBER,
  DELIVERED: STATUS_GRAY,
  DELAYED: STATUS_AMBER,
  CANCELLED: STATUS_RED,
  // Rentabilität (Kalkulation)
  profitable: STATUS_GREEN,
  tight: STATUS_AMBER,
  warning: STATUS_RED,
  // Verfügbarkeit (Disposition)
  VERFUEGBAR: STATUS_GREEN,
  URLAUB: STATUS_AMBER,
}

const STATUS_BADGE_FALLBACK = STATUS_GRAY

function Badge({
  className,
  variant = "default",
  status,
  label,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    status?: string
    label?: React.ReactNode
  }) {
  const Comp = asChild ? Slot.Root : "span"
  const statusClass = status
    ? statusBadgeColors[status] ?? STATUS_BADGE_FALLBACK
    : undefined

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-status={status}
      className={cn(badgeVariants({ variant }), statusClass, className)}
      {...props}
    >
      {label ?? children}
    </Comp>
  )
}

export { Badge, badgeVariants }
