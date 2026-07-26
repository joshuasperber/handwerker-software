"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CanAccess } from "@/components/auth/can-access";
import { fetchJson } from "@/lib/fetch-json";
import { saveJson } from "@/lib/save-toast";
import { formatDate, formatDateTime, formatEuro, ORDER_STATUS_LABELS } from "@/lib/utils";
import { PHOTO_CATEGORIES } from "@/lib/files";
import { PROJECT_COST_SOURCE_LABELS, PROJECT_STATUS_LABELS } from "@/lib/projects/types";
import {
  ArrowLeft,
  Camera,
  FileText,
  FolderKanban,
  Link2,
  Loader2,
  Plus,
  Receipt,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

interface ProjectDetail {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  startDate: string | null;
  endDate: string | null;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  description: string | null;
  notes: string | null;
  customer: { id: string; name: string; email: string };
  team: { id: string; name: string } | null;
  members: { id: string; employeeId: string; name: string }[];
  orders: {
    id: string;
    orderNumber: string;
    title: string | null;
    status: string;
    statusLabel: string;
    createdAt: string;
  }[];
  counts: { orders: number; notesEntries: number; files: number; costs: number };
}

interface NoteItem {
  id: string;
  body: string;
  orderId: string | null;
  orderNumber: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface FileItem {
  id: string;
  fileName: string;
  mimeType: string;
  url: string | null;
  categoryLabel: string;
  description: string | null;
  orderNumber: string | null;
  createdAt: string;
  uploadedBy: string | null;
}

interface CostItem {
  id: string;
  description: string;
  sourceLabel: string;
  quantity: number;
  unit: string | null;
  netAmount: number;
  grossAmount: number;
  paidAmount: number;
  openAmount: number;
  isReimbursable: boolean;
  isBillable: boolean;
  orderNumber: string | null;
  createdAt: string;
}

interface ClosingOverview {
  project: { name: string };
  orders: ProjectDetail["orders"];
  materials: Array<{
    id: string;
    description: string;
    quantity: number;
    unit: string | null;
    netAmount: number;
    orderNumber: string | null;
  }>;
  costs: CostItem[];
  notes: NoteItem[];
  photos: FileItem[];
  totals: {
    costNet: number;
    costGross: number;
    costPaid: number;
    costOpen: number;
    reimbursableNet: number;
    reimbursableCount: number;
    billableNet: number;
    billableCount: number;
    invoicePaid: number;
    invoiceOpen: number;
  };
  invoiceCandidates: Array<{
    id: string;
    kind: "cost" | "order";
    costId: string | null;
    orderId: string | null;
    label: string;
    netAmount: number;
    selectedByDefault: boolean;
  }>;
  existingCalculations: Array<{
    id: string;
    title: string | null;
    netSalesPrice: number;
    grossSalesPrice: number;
    invoiceNumber: string | null;
  }>;
}

interface OrderOption {
  id: string;
  orderNumber: string;
  title: string | null;
  status: string;
  projectId?: string | null;
}

type Tab = "uebersicht" | "auftraege" | "medien" | "kosten" | "abschluss";

export default function ProjektDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("uebersicht");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [costs, setCosts] = useState<CostItem[]>([]);
  const [closing, setClosing] = useState<ClosingOverview | null>(null);
  const [linkableOrders, setLinkableOrders] = useState<OrderOption[]>([]);
  const [linkOrderId, setLinkOrderId] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteOrderId, setNoteOrderId] = useState("");
  const [costForm, setCostForm] = useState({
    description: "",
    netAmount: "",
    vatAmount: "0",
    quantity: "1",
    unit: "Stk",
    source: "MANUAL",
    isReimbursable: false,
    isBillable: true,
    paidAmount: "0",
  });
  const [fileCategory, setFileCategory] = useState("BAUSTELLE");
  const [fileDesc, setFileDesc] = useState("");
  const [fileOrderId, setFileOrderId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  const loadProject = useCallback(async () => {
    const res = await fetchJson<ProjectDetail>(`/api/projects/${id}`);
    if (res.success && res.data) setProject(res.data);
    else setProject(null);
    setLoading(false);
  }, [id]);

  const loadNotes = useCallback(async () => {
    const res = await fetchJson<NoteItem[]>(`/api/projects/${id}/notes`);
    if (res.success && res.data) setNotes(res.data);
  }, [id]);

  const loadFiles = useCallback(async () => {
    const res = await fetchJson<FileItem[]>(`/api/projects/${id}/files`);
    if (res.success && res.data) setFiles(res.data);
  }, [id]);

  const loadCosts = useCallback(async () => {
    const res = await fetchJson<CostItem[]>(`/api/projects/${id}/costs`);
    if (res.success && res.data) setCosts(res.data);
  }, [id]);

  const loadClosing = useCallback(async () => {
    const res = await fetchJson<ClosingOverview>(`/api/projects/${id}/closing`);
    if (res.success && res.data) {
      setClosing(res.data);
      setSelectedInvoiceIds(
        res.data.invoiceCandidates.filter((c) => c.selectedByDefault).map((c) => c.id)
      );
    }
  }, [id]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (tab === "medien" || tab === "uebersicht") {
      void loadNotes();
      void loadFiles();
    }
    if (tab === "kosten" || tab === "uebersicht") void loadCosts();
    if (tab === "abschluss") void loadClosing();
    if (tab === "auftraege") {
      void fetchJson<OrderOption[]>("/api/orders").then((res) => {
        if (res.success && res.data) {
          setLinkableOrders(res.data.filter((o) => !o.projectId || o.projectId === id));
        }
      });
    }
  }, [tab, id, loadNotes, loadFiles, loadCosts, loadClosing]);

  const tabs: { id: Tab; label: string }[] = useMemo(
    () => [
      { id: "uebersicht", label: "Übersicht" },
      { id: "auftraege", label: "Aufträge" },
      { id: "medien", label: "Fotos & Notizen" },
      { id: "kosten", label: "Kosten" },
      { id: "abschluss", label: "Abschluss" },
    ],
    []
  );

  async function linkOrder() {
    if (!linkOrderId) return;
    const res = await saveJson(`/api/projects/${id}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: linkOrderId }),
    }, { success: "Auftrag verknüpft" });
    if (res.success) {
      setLinkOrderId("");
      void loadProject();
    }
  }

  async function unlinkOrder(orderId: string) {
    const res = await saveJson(
      `/api/projects/${id}/orders?orderId=${encodeURIComponent(orderId)}`,
      { method: "DELETE" },
      { success: "Verknüpfung entfernt" }
    );
    if (res.success) void loadProject();
  }

  async function addNote() {
    if (!noteBody.trim()) return;
    const res = await saveJson(
      `/api/projects/${id}/notes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: noteBody,
          orderId: noteOrderId || null,
        }),
      },
      { success: "Notiz gespeichert" }
    );
    if (res.success) {
      setNoteBody("");
      setNoteOrderId("");
      void loadNotes();
      void loadProject();
    }
  }

  async function addCost() {
    const net = Number(costForm.netAmount.replace(",", "."));
    const vat = Number(costForm.vatAmount.replace(",", ".")) || 0;
    if (!costForm.description.trim() || !Number.isFinite(net)) {
      toast.error("Beschreibung und Betrag erforderlich");
      return;
    }
    const res = await saveJson(
      `/api/projects/${id}/costs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: costForm.description,
          netAmount: net,
          vatAmount: vat,
          quantity: Number(costForm.quantity.replace(",", ".")) || 1,
          unit: costForm.unit || null,
          source: costForm.source,
          isReimbursable: costForm.isReimbursable,
          isBillable: costForm.isBillable,
          paidAmount: Number(costForm.paidAmount.replace(",", ".")) || 0,
        }),
      },
      { success: "Kostenposition gespeichert" }
    );
    if (res.success) {
      setCostForm({
        description: "",
        netAmount: "",
        vatAmount: "0",
        quantity: "1",
        unit: "Stk",
        source: "MANUAL",
        isReimbursable: false,
        isBillable: true,
        paidAmount: "0",
      });
      void loadCosts();
      void loadProject();
    }
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(fileList).forEach((f) => formData.append("file", f));
    formData.set("category", fileCategory);
    if (fileDesc.trim()) formData.set("description", fileDesc.trim());
    if (fileOrderId) formData.set("orderId", fileOrderId);

    const res = await saveJson(`/api/projects/${id}/files`, {
      method: "POST",
      body: formData,
    }, { success: "Foto(s) hochgeladen" });
    setUploading(false);
    if (res.success) {
      setFileDesc("");
      void loadFiles();
      void loadProject();
    }
  }

  async function createInvoice() {
    if (!closing || selectedInvoiceIds.length === 0) {
      toast.error("Bitte Positionen auswählen");
      return;
    }
    setInvoiceBusy(true);
    const costIds = closing.invoiceCandidates
      .filter((c) => c.kind === "cost" && selectedInvoiceIds.includes(c.id) && c.costId)
      .map((c) => c.costId!);
    const orderIds = closing.invoiceCandidates
      .filter((c) => c.kind === "order" && selectedInvoiceIds.includes(c.id) && c.orderId)
      .map((c) => c.orderId!);

    const res = await saveJson<{ id: string }>(
      `/api/projects/${id}/invoice`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costIds, orderIds }),
      },
      { success: "Kalkulation für Abschlussrechnung erstellt" }
    );
    setInvoiceBusy(false);
    if (res.success && res.data) {
      router.push(`/dashboard/kalkulation/${res.data.id}`);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Laden …
      </div>
    );
  }

  if (!project) {
    return (
      <Card className="!p-8 text-center text-slate-500">
        Projekt nicht gefunden.{" "}
        <Link href="/dashboard/projekte" className="text-[#0d5c63] underline">
          Zurück
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard/projekte"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Projekte
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-slate-900">
              <FolderKanban className="h-7 w-7 text-[#0d5c63]" />
              {project.name}
              <Badge variant="secondary">{project.statusLabel}</Badge>
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {project.customer.name}
              {(project.addressStreet || project.addressCity) &&
                ` · ${[project.addressStreet, project.addressZip, project.addressCity]
                  .filter(Boolean)
                  .join(" ")}`}
            </p>
          </div>
          <CanAccess permission="calculations.write">
            <Button variant="outline" size="sm" onClick={() => setTab("abschluss")}>
              <Receipt className="mr-1 h-4 w-4" />
              Abschlussrechnung
            </Button>
          </CanAccess>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-t-md px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border border-b-white border-slate-200 bg-white text-[#0d5c63]"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "uebersicht" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="!p-4 lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Projektdaten</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-400">Status</dt>
                <dd>{PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS] ?? project.status}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Zeitraum</dt>
                <dd>
                  {project.startDate ? formatDate(project.startDate) : "—"}
                  {project.endDate ? ` – ${formatDate(project.endDate)}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Team</dt>
                <dd>{project.team?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Mitarbeiter</dt>
                <dd>
                  {project.members.length
                    ? project.members.map((m) => m.name).join(", ")
                    : "—"}
                </dd>
              </div>
            </dl>
            {project.description && (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{project.description}</p>
            )}
            {project.notes && (
              <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600 whitespace-pre-wrap">
                {project.notes}
              </div>
            )}
          </Card>
          <Card className="!p-4 space-y-2 text-sm">
            <h2 className="text-sm font-semibold text-slate-800">Kennzahlen</h2>
            <p>{project.counts.orders} Aufträge</p>
            <p>{project.counts.files} Fotos / Dateien</p>
            <p>{project.counts.notesEntries} Notizen</p>
            <p>{project.counts.costs} Kostenpositionen</p>
            <p className="text-xs text-slate-400 pt-2">
              Summe Kosten netto:{" "}
              {formatEuro(costs.reduce((s, c) => s + c.netAmount, 0))}
            </p>
          </Card>
          <Card className="!p-0 lg:col-span-3 overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">
              Zugehörige Aufträge
            </div>
            {project.orders.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Noch keine Aufträge verknüpft.</p>
            ) : (
              project.orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/dashboard/auftraege/${o.id}`}
                  className="flex items-center justify-between border-b border-slate-50 px-4 py-3 text-sm hover:bg-slate-50 last:border-0"
                >
                  <span>
                    {o.orderNumber}
                    {o.title ? ` · ${o.title}` : ""}
                  </span>
                  <Badge variant="secondary">{o.statusLabel}</Badge>
                </Link>
              ))
            )}
          </Card>
        </div>
      )}

      {tab === "auftraege" && (
        <div className="space-y-4">
          <CanAccess permission="orders.write">
            <Card className="!p-4">
              <h2 className="mb-3 text-sm font-semibold">Auftrag verknüpfen</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={linkOrderId} onValueChange={setLinkOrderId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Auftrag wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {linkableOrders
                      .filter((o) => !project.orders.some((po) => po.id === o.id))
                      .map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.orderNumber}
                          {o.title ? ` · ${o.title}` : ""} ·{" "}
                          {ORDER_STATUS_LABELS[o.status] ?? o.status}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={linkOrder} disabled={!linkOrderId}>
                  <Link2 className="mr-1 h-4 w-4" /> Verknüpfen
                </Button>
              </div>
            </Card>
          </CanAccess>

          <Card className="!p-0 overflow-hidden">
            {project.orders.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                Keine Aufträge im Projekt.
              </p>
            ) : (
              project.orders.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <Link
                      href={`/dashboard/auftraege/${o.id}`}
                      className="font-medium text-[#0d5c63] hover:underline"
                    >
                      {o.orderNumber}
                      {o.title ? ` · ${o.title}` : ""}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {formatDate(o.createdAt)} · {o.statusLabel}
                    </p>
                  </div>
                  <CanAccess permission="orders.write">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => unlinkOrder(o.id)}
                    >
                      <Unlink className="mr-1 h-3.5 w-3.5" /> Lösen
                    </Button>
                  </CanAccess>
                </div>
              ))
            )}
          </Card>
        </div>
      )}

      {tab === "medien" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="!p-4 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Camera className="h-4 w-4" /> Fotos
            </h2>
            <CanAccess permission="orders.write">
              <div className="space-y-2 rounded-md border border-dashed border-slate-300 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Kategorie</Label>
                    <select
                      value={fileCategory}
                      onChange={(e) => setFileCategory(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm"
                    >
                      {PHOTO_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Auftrag (optional)</Label>
                    <select
                      value={fileOrderId}
                      onChange={(e) => setFileOrderId(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm"
                    >
                      <option value="">Nur Projekt</option>
                      {project.orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.orderNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Input
                  placeholder="Kurzbeschreibung (optional)"
                  value={fileDesc}
                  onChange={(e) => setFileDesc(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#0d5c63] px-3 py-2 text-sm text-white">
                    <Plus className="h-4 w-4" />
                    {uploading ? "Hochladen …" : "Hochladen"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        void uploadFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <Camera className="h-4 w-4" />
                    Foto aufnehmen
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        void uploadFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </CanAccess>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {files.map((f) => (
                <a
                  key={f.id}
                  href={f.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-md border border-slate-200"
                >
                  {f.mimeType.startsWith("image/") && f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt={f.fileName} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-slate-50 text-xs text-slate-500">
                      PDF / Datei
                    </div>
                  )}
                  <div className="p-2 text-[11px] text-slate-500">
                    <p className="truncate font-medium text-slate-700">{f.categoryLabel}</p>
                    <p>{formatDateTime(f.createdAt)}</p>
                    {f.uploadedBy && <p>{f.uploadedBy}</p>}
                  </div>
                </a>
              ))}
            </div>
            {files.length === 0 && (
              <p className="text-sm text-slate-500">Noch keine Fotos im Projekt.</p>
            )}
          </Card>

          <Card className="!p-4 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4" /> Notizen
            </h2>
            <CanAccess permission="orders.write">
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Notiz zum Projekt oder Auftrag …"
                rows={3}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={noteOrderId}
                  onChange={(e) => setNoteOrderId(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-slate-300 px-2 text-sm"
                >
                  <option value="">Nur Projekt</option>
                  {project.orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber}
                    </option>
                  ))}
                </select>
                <Button type="button" onClick={addNote} disabled={!noteBody.trim()}>
                  Notiz speichern
                </Button>
              </div>
            </CanAccess>
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-md border border-slate-100 p-3 text-sm">
                  <p className="whitespace-pre-wrap text-slate-800">{n.body}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {formatDateTime(n.createdAt)}
                    {n.createdBy ? ` · ${n.createdBy}` : ""}
                    {n.orderNumber ? ` · ${n.orderNumber}` : ""}
                  </p>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-sm text-slate-500">Noch keine Notizen.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "kosten" && (
        <div className="space-y-4">
          <CanAccess permission="orders.write">
            <Card className="!p-4 space-y-3">
              <h2 className="text-sm font-semibold">Kosten / Material erfassen</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Beschreibung</Label>
                  <Input
                    value={costForm.description}
                    onChange={(e) => setCostForm({ ...costForm, description: e.target.value })}
                    placeholder="z. B. Tür, Acrylfarbe, Maschinenmiete …"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Netto €</Label>
                  <Input
                    value={costForm.netAmount}
                    onChange={(e) => setCostForm({ ...costForm, netAmount: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>MwSt €</Label>
                  <Input
                    value={costForm.vatAmount}
                    onChange={(e) => setCostForm({ ...costForm, vatAmount: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Menge</Label>
                  <Input
                    value={costForm.quantity}
                    onChange={(e) => setCostForm({ ...costForm, quantity: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Einheit</Label>
                  <Input
                    value={costForm.unit}
                    onChange={(e) => setCostForm({ ...costForm, unit: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Quelle</Label>
                  <select
                    value={costForm.source}
                    onChange={(e) => setCostForm({ ...costForm, source: e.target.value })}
                    className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                  >
                    {Object.entries(PROJECT_COST_SOURCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Bereits bezahlt €</Label>
                  <Input
                    value={costForm.paidAmount}
                    onChange={(e) => setCostForm({ ...costForm, paidAmount: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={costForm.isBillable}
                    onChange={(e) =>
                      setCostForm({ ...costForm, isBillable: e.target.checked })
                    }
                  />
                  Für Abschlussrechnung
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={costForm.isReimbursable}
                    onChange={(e) =>
                      setCostForm({ ...costForm, isReimbursable: e.target.checked })
                    }
                  />
                  Erstattungsfähig / weiterberechnen
                </label>
              </div>
              <Button type="button" onClick={addCost}>
                Kosten speichern
              </Button>
            </Card>
          </CanAccess>

          <Card className="!p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-3 py-2">Position</th>
                  <th className="px-3 py-2">Quelle</th>
                  <th className="px-3 py-2 text-right">Netto</th>
                  <th className="px-3 py-2 text-right">Offen</th>
                  <th className="px-3 py-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {costs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                      Noch keine Kosten erfasst.
                    </td>
                  </tr>
                ) : (
                  costs.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <p className="font-medium">{c.description}</p>
                        <p className="text-xs text-slate-400">
                          {c.quantity}
                          {c.unit ? ` ${c.unit}` : ""}
                          {c.orderNumber ? ` · ${c.orderNumber}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{c.sourceLabel}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatEuro(c.netAmount)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatEuro(c.openAmount)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {c.isBillable && (
                            <Badge className="border-0 bg-emerald-50 text-emerald-800 text-[10px]">
                              Rechnung
                            </Badge>
                          )}
                          {c.isReimbursable && (
                            <Badge className="border-0 bg-amber-50 text-amber-800 text-[10px]">
                              Erstattung
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "abschluss" && (
        <div className="space-y-4">
          {!closing ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Abschlussübersicht laden …
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card className="!p-4">
                  <p className="text-xs text-slate-500">Kosten netto</p>
                  <p className="text-xl font-bold">{formatEuro(closing.totals.costNet)}</p>
                </Card>
                <Card className="!p-4">
                  <p className="text-xs text-slate-500">Bezahlt / Offen</p>
                  <p className="text-xl font-bold">
                    {formatEuro(closing.totals.costPaid)}
                  </p>
                  <p className="text-xs text-amber-700">
                    Offen {formatEuro(closing.totals.costOpen)}
                  </p>
                </Card>
                <Card className="!p-4">
                  <p className="text-xs text-slate-500">Erstattungsfähig</p>
                  <p className="text-xl font-bold">
                    {formatEuro(closing.totals.reimbursableNet)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {closing.totals.reimbursableCount} Position(en)
                  </p>
                </Card>
                <Card className="!p-4">
                  <p className="text-xs text-slate-500">Rechnungen (Aufträge)</p>
                  <p className="text-xl font-bold">
                    {formatEuro(closing.totals.invoicePaid)}
                  </p>
                  <p className="text-xs text-amber-700">
                    Offen {formatEuro(closing.totals.invoiceOpen)}
                  </p>
                </Card>
              </div>

              <Card className="!p-4 space-y-3">
                <h2 className="text-sm font-semibold">Positionen für Abschlussrechnung</h2>
                <p className="text-xs text-slate-500">
                  Wähle aus, welche Kosten und Aufträge in die Kalkulation übernommen werden.
                  Anschließend kannst du die Rechnung in der Kalkulation finalisieren.
                </p>
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                  {closing.invoiceCandidates.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedInvoiceIds.includes(c.id)}
                          onChange={() =>
                            setSelectedInvoiceIds((ids) =>
                              ids.includes(c.id)
                                ? ids.filter((x) => x !== c.id)
                                : [...ids, c.id]
                            )
                          }
                        />
                        <span className="truncate">{c.label}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {c.kind === "cost" ? "Kosten" : "Auftrag"}
                        </Badge>
                      </span>
                      {c.netAmount > 0 && (
                        <span className="shrink-0 tabular-nums text-slate-600">
                          {formatEuro(c.netAmount)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <CanAccess permission="calculations.write">
                  <Button
                    type="button"
                    onClick={createInvoice}
                    disabled={invoiceBusy || selectedInvoiceIds.length === 0}
                  >
                    {invoiceBusy ? "Erstellen …" : "Kalkulation / Rechnung vorbereiten"}
                  </Button>
                </CanAccess>
                {closing.existingCalculations.length > 0 && (
                  <div className="border-t border-slate-100 pt-3 text-sm">
                    <p className="mb-2 text-xs font-medium text-slate-500">
                      Bestehende Projekt-Kalkulationen
                    </p>
                    {closing.existingCalculations.map((c) => (
                      <Link
                        key={c.id}
                        href={`/dashboard/kalkulation/${c.id}`}
                        className="block text-[#0d5c63] hover:underline"
                      >
                        {c.title ?? "Kalkulation"} · {formatEuro(c.netSalesPrice)}
                        {c.invoiceNumber ? ` · ${c.invoiceNumber}` : ""}
                      </Link>
                    ))}
                  </div>
                )}
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="!p-4">
                  <h3 className="mb-2 text-sm font-semibold">Aufträge</h3>
                  <ul className="space-y-1 text-sm">
                    {closing.orders.map((o) => (
                      <li key={o.id}>
                        <Link href={`/dashboard/auftraege/${o.id}`} className="text-[#0d5c63] hover:underline">
                          {o.orderNumber} · {o.statusLabel}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card className="!p-4">
                  <h3 className="mb-2 text-sm font-semibold">Materialien</h3>
                  {closing.materials.length === 0 ? (
                    <p className="text-sm text-slate-500">Keine Materialien dokumentiert.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {closing.materials.slice(0, 20).map((m) => (
                        <li key={m.id} className="flex justify-between gap-2">
                          <span className="truncate">
                            {m.description}
                            {m.orderNumber ? ` (${m.orderNumber})` : ""}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {formatEuro(m.netAmount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card className="!p-4">
                  <h3 className="mb-2 text-sm font-semibold">
                    Notizen ({closing.notes.length})
                  </h3>
                  <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
                    {closing.notes.slice(0, 10).map((n) => (
                      <p key={n.id} className="text-slate-600 line-clamp-2">
                        {n.body}
                      </p>
                    ))}
                  </div>
                </Card>
                <Card className="!p-4">
                  <h3 className="mb-2 text-sm font-semibold">
                    Fotos ({closing.photos.length})
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {closing.photos.slice(0, 9).map((f) =>
                      f.url && f.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={f.id}
                          src={f.url}
                          alt={f.fileName}
                          className="h-20 w-full rounded object-cover"
                        />
                      ) : (
                        <div
                          key={f.id}
                          className="flex h-20 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-500"
                        >
                          Datei
                        </div>
                      )
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
