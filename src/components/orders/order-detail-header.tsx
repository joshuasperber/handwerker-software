"use client";

import Link from "next/link";
import {
  Calculator,
  CheckCircle,
  ExternalLink,
  Flag,
  MoreHorizontal,
  PhoneCall,
  RefreshCw,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CanAccess } from "@/components/auth/can-access";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  isOverdue,
} from "@/lib/utils";
import { formatOrderTypeLabel } from "@/lib/orders/order-type-label";

const CONFIRMATION_LABELS: Record<string, string> = {
  OFFEN: "Kunde offen",
  BESTAETIGT: "Kunde bestätigt",
  ABGESAGT: "Kunde abgesagt",
  NICHT_ERREICHBAR: "Nicht erreichbar",
};

export interface OrderDetailHeaderProps {
  order: {
    id: string;
    orderNumber: string;
    title?: string | null;
    status: string;
    priority: string;
    scheduledStart: string | null;
    customerConfirmationStatus?: string;
    team?: { id: string; name: string } | null;
    project?: { id: string; name: string } | null;
    orderTypeLabel?: string | null;
    orderTypeCustom?: string | null;
    orderType?: string | null;
    orderTypeDefinition?: { name: string; isOther: boolean } | null;
  };
  calculation: { id: string } | null;
  canPlanTeam: boolean;
  onCreateCalculation: () => void;
  onPlanTeamInCalendar: () => void;
  onComplete: () => void;
  onUpdatePriority: (priority: string) => void;
  onUpdateStatus: (status: string) => void;
  onUpdateConfirmation: (status: string) => void;
}

export function OrderDetailHeader({
  order,
  calculation,
  canPlanTeam,
  onCreateCalculation,
  onPlanTeamInCalendar,
  onComplete,
  onUpdatePriority,
  onUpdateStatus,
  onUpdateConfirmation,
}: OrderDetailHeaderProps) {
  const confirmation = order.customerConfirmationStatus ?? "OFFEN";
  const canComplete = !["ABRECHNUNGSBEREIT", "ABGERECHNET", "STORNIERT"].includes(
    order.status
  );

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900 break-words">
          {order.title ?? order.orderNumber}
        </h1>
        <p className="text-sm text-slate-400">{order.orderNumber}</p>
        <p className="text-sm text-slate-600 mt-1">
          Auftragstyp:{" "}
          <span className="font-medium text-slate-800">
            {formatOrderTypeLabel(order)}
          </span>
        </p>
        {order.project && (
          <p className="mt-1 text-sm">
            <Link
              href={`/dashboard/projekte/${order.project.id}`}
              className="text-[#0d5c63] hover:underline"
            >
              Projekt: {order.project.name}
            </Link>
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {isOverdue(order.scheduledStart, order.status) && (
            <Badge status="UEBERFAELLIG" label="Überfällig" />
          )}
          <Badge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[order.priority]}`}
          >
            {PRIORITY_LABELS[order.priority]}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {CONFIRMATION_LABELS[confirmation] ?? confirmation}
          </span>
        </div>
      </div>

      <CanAccess permission="orders.write">
        <div className="flex shrink-0 items-center gap-2">
          {canComplete && (
            <Button size="sm" variant="action" onClick={onComplete}>
              <CheckCircle className="h-4 w-4 mr-1" /> Abschließen
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" aria-label="Weitere Aktionen">
                <MoreHorizontal className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Aktionen</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <CanAccess permission="calculations.write">
                {calculation ? (
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/kalkulation/${calculation.id}`}>
                      <ExternalLink className="h-4 w-4 mr-2" /> Zur Kalkulation
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={onCreateCalculation}>
                    <Calculator className="h-4 w-4 mr-2" /> Grundkalkulation erstellen
                  </DropdownMenuItem>
                )}
              </CanAccess>
              <CanAccess permission="orders.assign">
                {order.team ? (
                  <DropdownMenuItem
                    disabled={!canPlanTeam}
                    onSelect={onPlanTeamInCalendar}
                  >
                    <Users className="h-4 w-4 mr-2" /> Team in Kalender
                    {!canPlanTeam && (
                      <span className="ml-auto text-xs text-slate-400">
                        Termin fehlt
                      </span>
                    )}
                  </DropdownMenuItem>
                ) : null}
              </CanAccess>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-slate-400">
                Ändern
              </DropdownMenuLabel>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <RefreshCw className="h-4 w-4 mr-2" /> Status
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuRadioGroup
                    value={order.status}
                    onValueChange={onUpdateStatus}
                  >
                    {ORDER_STATUS_FLOW.map((status) => (
                      <DropdownMenuRadioItem key={status} value={status}>
                        {ORDER_STATUS_LABELS[status]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Flag className="h-4 w-4 mr-2" /> Priorität
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={order.priority}
                    onValueChange={onUpdatePriority}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <DropdownMenuRadioItem key={key} value={key}>
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <PhoneCall className="h-4 w-4 mr-2" /> Kundenbestätigung
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  <DropdownMenuRadioGroup
                    value={confirmation}
                    onValueChange={onUpdateConfirmation}
                  >
                    {Object.entries(CONFIRMATION_LABELS).map(([key, label]) => (
                      <DropdownMenuRadioItem key={key} value={key}>
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CanAccess>
    </div>
  );
}
