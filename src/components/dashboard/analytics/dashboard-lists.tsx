"use client";

import Link from "next/link";
import { CalendarClock, ClipboardList, AlertTriangle, ChevronRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEuro, formatDateTime, formatDate, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/utils";
import type {
  UpcomingAppointmentDTO,
  RecentOrderDTO,
  OverdueInvoiceDTO,
} from "@/lib/dashboard/analytics";

function EmptyRow({ message }: { message: string }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>
  );
}

export function UpcomingAppointmentsList({
  items,
}: {
  items: UpcomingAppointmentDTO[];
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[#0d5c63]" />
          Nächste Termine
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <EmptyRow message="Keine anstehenden Termine." />
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((appt) => (
              <li key={appt.id}>
                <Link
                  href={appt.orderId ? `/dashboard/auftraege/${appt.orderId}` : "/dashboard/termine"}
                  className="group flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{appt.customer}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateTime(appt.start)}
                      {appt.city ? ` · ${appt.city}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {appt.employee && (
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {appt.employee}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentOrdersList({ items }: { items: RecentOrderDTO[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#0d5c63]" />
          Neueste Aufträge
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <EmptyRow message="Noch keine Aufträge vorhanden." />
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/dashboard/auftraege/${order.id}`}
                  className="group flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#0d5c63]">
                      {order.orderNumber}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.customer}
                      {order.city ? ` · ${order.city}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        PRIORITY_COLORS[order.priority] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {PRIORITY_LABELS[order.priority] ?? order.priority}
                    </span>
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                      {order.statusLabel}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function OverdueInvoicesList({ items }: { items: OverdueInvoiceDTO[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          Überfällige Rechnungen
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <EmptyRow message="Keine überfälligen Rechnungen. 🎉" />
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((invoice) => (
              <li
                key={invoice.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{invoice.documentNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {invoice.customer} · fällig {formatDate(invoice.dueDate)}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-red-600 tabular-nums">
                  {formatEuro(invoice.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
