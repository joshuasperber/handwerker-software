"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  PHASE_STATUS_LABELS,
  PHASE_STATUS_FLOW,
  PHASE_STATUS_BADGE,
} from "@/lib/utils";
import {
  Check,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { PhotoGallery } from "@/components/orders/photo-gallery";

export interface OrderPhaseData {
  id: string;
  name: string;
  status: string;
  isEnabled: boolean;
  sortOrder: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  notes: string | null;
  specialNotes: string | null;
  assignedTeamId: string | null;
  assignedEmployeeId: string | null;
  assignedTeam?: { id: string; name: string } | null;
  assignedEmployee?: { user: { firstName: string; lastName: string } } | null;
  files?: { id: string; fileName: string }[];
}

interface OrderPhasesProps {
  orderId: string;
  phases: OrderPhaseData[];
  teams: { id: string; name: string }[];
  employees: { id: string; user: { firstName: string; lastName: string } }[];
  canEdit: boolean;
  onChanged: () => void;
  /** Basis-URL der Datei-API für Phasen-Fotos. */
  filesBaseUrl?: string;
  /** Dürfen Fotos zu Phasen hochgeladen/gelöscht werden? */
  canManageFiles?: boolean;
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 16);
}

export function OrderPhases({
  orderId,
  phases,
  teams,
  employees,
  canEdit,
  onChanged,
  filesBaseUrl = `/api/orders/${orderId}/files`,
  canManageFiles = canEdit,
}: OrderPhasesProps) {
  const [showDisabled, setShowDisabled] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const sorted = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
  const enabled = sorted.filter((p) => p.isEnabled);
  const visible = showDisabled ? sorted : enabled;

  async function patchPhase(phaseId: string, data: Record<string, unknown>) {
    setBusyId(phaseId);
    const res = await fetch(`/api/orders/${orderId}/phases/${phaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusyId(null);
    if (res.ok) {
      onChanged();
    } else {
      toast.error("Phase konnte nicht aktualisiert werden");
    }
  }

  async function deletePhase(phaseId: string) {
    setBusyId(phaseId);
    const res = await fetch(`/api/orders/${orderId}/phases/${phaseId}`, {
      method: "DELETE",
    });
    setBusyId(null);
    if (res.ok) {
      toast.success("Phase gelöscht");
      onChanged();
    } else {
      toast.error("Phase konnte nicht gelöscht werden");
    }
  }

  async function reorder(list: OrderPhaseData[]) {
    const res = await fetch(`/api/orders/${orderId}/phases`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: list.map((p) => p.id) }),
    });
    if (res.ok) onChanged();
    else toast.error("Reihenfolge konnte nicht gespeichert werden");
  }

  function move(phase: OrderPhaseData, direction: -1 | 1) {
    const idx = sorted.findIndex((p) => p.id === phase.id);
    const target = idx + direction;
    if (target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[target]] = [next[target], next[idx]];
    reorder(next);
  }

  async function addPhase() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const res = await fetch(`/api/orders/${orderId}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setAdding(false);
    if (res.ok) {
      setNewName("");
      onChanged();
    } else {
      toast.error("Phase konnte nicht hinzugefügt werden");
    }
  }

  async function resetDefaults() {
    const res = await fetch(`/api/orders/${orderId}/phases`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resetDefaults" }),
    });
    if (res.ok) onChanged();
    else toast.error("Standardphasen konnten nicht wiederhergestellt werden");
  }

  return (
    <Card
      title="Phasen"
      action={
        canEdit && phases.length === 0 ? (
          <Button size="sm" variant="outline" onClick={resetDefaults}>
            <RotateCcw className="h-4 w-4 mr-1" /> Standardphasen anlegen
          </Button>
        ) : null
      }
    >
      <PhaseStepper phases={enabled} />

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <Switch
              size="sm"
              checked={showDisabled}
              onCheckedChange={setShowDisabled}
            />
            Deaktivierte Phasen anzeigen
          </label>
        </div>
      )}

      <Accordion type="multiple" className="mt-2">
        {visible.map((phase) => {
          const stepNumber = enabled.findIndex((p) => p.id === phase.id) + 1;
          return (
            <PhaseRow
              key={phase.id}
              phase={phase}
              stepLabel={phase.isEnabled && stepNumber > 0 ? String(stepNumber) : "–"}
              teams={teams}
              employees={employees}
              canEdit={canEdit}
              busy={busyId === phase.id}
              isFirst={sorted[0]?.id === phase.id}
              isLast={sorted[sorted.length - 1]?.id === phase.id}
              orderId={orderId}
              filesBaseUrl={filesBaseUrl}
              canManageFiles={canManageFiles}
              onPatch={(data) => patchPhase(phase.id, data)}
              onDelete={() => deletePhase(phase.id)}
              onMoveUp={() => move(phase, -1)}
              onMoveDown={() => move(phase, 1)}
              onUploaded={onChanged}
            />
          );
        })}
      </Accordion>

      {visible.length === 0 && (
        <p className="text-sm text-slate-500 py-2">Keine Phasen vorhanden.</p>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addPhase();
            }}
            placeholder="Eigene Phase hinzufügen…"
            className="h-9 flex-1 min-w-[160px] rounded-lg border border-slate-300 px-3 text-sm"
          />
          <Button size="sm" variant="outline" onClick={addPhase} disabled={adding || !newName.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1">Hinzufügen</span>
          </Button>
        </div>
      )}
    </Card>
  );
}

function statusColorClasses(status: string): string {
  switch (status) {
    case "ABGESCHLOSSEN":
      return "bg-green-600 text-white border-green-600";
    case "IN_ARBEIT":
      return "bg-amber-500 text-white border-amber-500";
    case "UEBERSPRUNGEN":
    case "STORNIERT":
      return "bg-slate-200 text-slate-400 border-slate-200 line-through";
    default:
      return "bg-white text-slate-500 border-slate-300";
  }
}

/** Kompakter horizontaler Stepper – auf Mobile horizontal scrollbar. */
function PhaseStepper({ phases }: { phases: OrderPhaseData[] }) {
  if (phases.length === 0) return null;
  return (
    <div className="flex items-start gap-1 overflow-x-auto pb-1 -mx-1 px-1">
      {phases.map((phase, idx) => (
        <div key={phase.id} className="flex items-center shrink-0">
          <div className="flex flex-col items-center gap-1 w-[68px] sm:w-20">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${statusColorClasses(
                phase.status
              )}`}
            >
              {phase.status === "ABGESCHLOSSEN" ? <Check className="h-4 w-4" /> : idx + 1}
            </span>
            <span className="text-[10px] sm:text-xs text-center leading-tight text-slate-600 line-clamp-2">
              {phase.name}
            </span>
          </div>
          {idx < phases.length - 1 && (
            <span
              className={`mt-4 h-0.5 w-3 sm:w-5 shrink-0 ${
                phase.status === "ABGESCHLOSSEN" ? "bg-green-500" : "bg-slate-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface PhaseRowProps {
  phase: OrderPhaseData;
  stepLabel: string;
  teams: { id: string; name: string }[];
  employees: { id: string; user: { firstName: string; lastName: string } }[];
  canEdit: boolean;
  busy: boolean;
  isFirst: boolean;
  isLast: boolean;
  orderId: string;
  filesBaseUrl: string;
  canManageFiles: boolean;
  onPatch: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUploaded: () => void;
}

function PhaseRow({
  phase,
  stepLabel,
  teams,
  employees,
  canEdit,
  busy,
  isFirst,
  isLast,
  orderId,
  filesBaseUrl,
  canManageFiles,
  onPatch,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUploaded,
}: PhaseRowProps) {
  void orderId;
  const [notes, setNotes] = useState(phase.notes ?? "");
  const [special, setSpecial] = useState(phase.specialNotes ?? "");
  const [team, setTeam] = useState(phase.assignedTeamId ?? "");
  const [employee, setEmployee] = useState(phase.assignedEmployeeId ?? "");
  const [start, setStart] = useState(toLocalInput(phase.plannedStart));
  const [end, setEnd] = useState(toLocalInput(phase.plannedEnd));

  const dirty =
    notes !== (phase.notes ?? "") ||
    special !== (phase.specialNotes ?? "") ||
    team !== (phase.assignedTeamId ?? "") ||
    employee !== (phase.assignedEmployeeId ?? "") ||
    start !== toLocalInput(phase.plannedStart) ||
    end !== toLocalInput(phase.plannedEnd);

  function saveDetails() {
    onPatch({
      notes,
      specialNotes: special,
      assignedTeamId: team || null,
      assignedEmployeeId: employee || null,
      plannedStart: start ? new Date(start).toISOString() : null,
      plannedEnd: end ? new Date(end).toISOString() : null,
    });
  }

  const fileCount = phase.files?.length ?? 0;

  return (
    <AccordionItem
      value={phase.id}
      className={phase.isEnabled ? "" : "opacity-60"}
    >
      <AccordionTrigger className="px-1 hover:no-underline">
        <div className="flex flex-1 items-center gap-3 pr-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${statusColorClasses(
              phase.status
            )}`}
          >
            {phase.status === "ABGESCHLOSSEN" ? <Check className="h-3.5 w-3.5" /> : stepLabel}
          </span>
          <span className="flex-1 text-sm font-medium text-slate-800">{phase.name}</span>
          {fileCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <ImageIcon className="h-3.5 w-3.5" /> {fileCount}
            </span>
          )}
          {!phase.isEnabled && (
            <span className="text-[10px] uppercase tracking-wide text-slate-400">deaktiviert</span>
          )}
          <Badge
            status={PHASE_STATUS_BADGE[phase.status] ?? "DRAFT"}
            label={PHASE_STATUS_LABELS[phase.status] ?? phase.status}
          />
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-1">
        {!canEdit ? (
          <div className="space-y-4 pt-1">
            <ReadOnlyPhase phase={phase} />
            <div>
              <label className="block text-xs text-slate-500 mb-1">Fotos / Dateien</label>
              <PhotoGallery
                baseUrl={filesBaseUrl}
                fixedPhaseId={phase.id}
                canUpload={canManageFiles}
                canDelete={canManageFiles}
                compact
                onChanged={onUploaded}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Status</label>
                <select
                  value={phase.status}
                  disabled={busy}
                  onChange={(e) => onPatch({ status: e.target.value })}
                  className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                >
                  {PHASE_STATUS_FLOW.map((s) => (
                    <option key={s} value={s}>{PHASE_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 mt-4 sm:mt-5">
                <Switch
                  checked={phase.isEnabled}
                  disabled={busy}
                  onCheckedChange={(v) => onPatch({ isEnabled: v })}
                />
                Phase aktiv
              </label>
              <div className="flex items-center gap-1 mt-4 sm:mt-5">
                <Button size="sm" variant="ghost" onClick={onMoveUp} disabled={isFirst || busy} title="Nach oben">
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={onMoveDown} disabled={isLast || busy} title="Nach unten">
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDelete}
                  disabled={busy}
                  title="Phase löschen"
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Zuständiges Team</label>
                <select
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-300 px-2 text-sm"
                >
                  <option value="">— Kein Team —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Zuständiger Mitarbeiter</label>
                <select
                  value={employee}
                  onChange={(e) => setEmployee(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-300 px-2 text-sm"
                >
                  <option value="">— Kein Mitarbeiter —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user.firstName} {emp.user.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Termin von</label>
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-300 px-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Termin bis</label>
                <input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-300 px-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Notizen</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Besonderheiten</label>
              <Textarea value={special} onChange={(e) => setSpecial(e.target.value)} rows={2} />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Fotos / Dateien</label>
              <PhotoGallery
                baseUrl={filesBaseUrl}
                fixedPhaseId={phase.id}
                canUpload={canManageFiles}
                canDelete={canManageFiles}
                compact
                onChanged={onUploaded}
              />
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={saveDetails} disabled={!dirty || busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Phase speichern
              </Button>
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function ReadOnlyPhase({ phase }: { phase: OrderPhaseData }) {
  const employeeName = phase.assignedEmployee
    ? `${phase.assignedEmployee.user.firstName} ${phase.assignedEmployee.user.lastName}`
    : null;
  return (
    <dl className="space-y-2 text-sm pt-1">
      {phase.assignedTeam && (
        <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Team</dt><dd>{phase.assignedTeam.name}</dd></div>
      )}
      {employeeName && (
        <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Mitarbeiter</dt><dd>{employeeName}</dd></div>
      )}
      {phase.notes && (
        <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Notizen</dt><dd className="whitespace-pre-wrap">{phase.notes}</dd></div>
      )}
      {phase.specialNotes && (
        <div className="flex gap-2"><dt className="text-slate-500 w-28 shrink-0">Besonderheiten</dt><dd className="whitespace-pre-wrap">{phase.specialNotes}</dd></div>
      )}
      {!phase.assignedTeam && !employeeName && !phase.notes && !phase.specialNotes && (
        <p className="text-slate-400">Keine weiteren Angaben.</p>
      )}
    </dl>
  );
}
