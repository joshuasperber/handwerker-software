"use client";

import Link from "next/link";
import { Calculator, CheckCircle, ExternalLink, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/auth/can-access";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  isOverdue,
} from "@/lib/utils";

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
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {order.title ?? order.orderNumber}
        </h1>
        <p className="text-sm text-slate-400">{order.orderNumber}</p>
        {isOverdue(order.scheduledStart, order.status) && (
          <Badge status="UEBERFAELLIG" label="Überfällig" className="mt-2 mr-2" />
        )}
        <Badge
          status={order.status}
          label={ORDER_STATUS_LABELS[order.status]}
          className="mt-2"
        />
        <span
          className={`ml-2 text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[order.priority]}`}
        >
          {PRIORITY_LABELS[order.priority]}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <CanAccess permission="calculations.write">
          {calculation ? (
            <Link href={`/dashboard/kalkulation/${calculation.id}`}>
              <Button size="sm" variant="outline">
                <ExternalLink className="h-4 w-4 mr-1" /> Zur Kalkulation
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant="outline" onClick={onCreateCalculation}>
              <Calculator className="h-4 w-4 mr-1" /> Grundkalkulation
            </Button>
          )}
        </CanAccess>
        <CanAccess permission="orders.assign">
          {order.team && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPlanTeamInCalendar}
              disabled={!canPlanTeam}
              title={!canPlanTeam ? "Zuerst Terminzeiten setzen" : undefined}
            >
              <Users className="h-4 w-4 mr-1" /> Team in Kalender
            </Button>
          )}
        </CanAccess>
        <CanAccess permission="orders.write">
          {!["ABRECHNUNGSBEREIT", "ABGERECHNET", "STORNIERT"].includes(order.status) && (
            <Button size="sm" variant="action" onClick={onComplete}>
              <CheckCircle className="h-4 w-4 mr-1" /> Abschließen
            </Button>
          )}
          <select
            value={order.priority}
            onChange={(e) => onUpdatePriority(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          >
            {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={order.status}
            onChange={(e) => onUpdateStatus(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          >
            {ORDER_STATUS_FLOW.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <select
            value={order.customerConfirmationStatus ?? "OFFEN"}
            onChange={(e) => onUpdateConfirmation(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            title="Kundenbestätigung für Terminerinnerungen"
          >
            {Object.entries(CONFIRMATION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </CanAccess>
      </div>
    </div>
  );
}
