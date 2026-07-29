"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfoButton } from "@/components/ui/info-button";
import { formatEuro, formatDate } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { saveJson } from "@/lib/save-toast";
import { CanAccess } from "@/components/auth/can-access";
import { AmountModeToggle } from "@/components/finance/amount-mode-toggle";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  amountModeLabel,
  pickAmount,
  useAmountMode,
} from "@/lib/amount-mode";
import {
  FileText,
  Receipt,
  Download,
  Send,
  Ban,
  Euro,
  BellRing,
  AlertTriangle,
  FileCode2,
  Loader2,
  CalendarDays,
  MoreHorizontal,
  Search,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatIssueDateInput } from "@/lib/documents/issue-date";
import {
  ISSUE_DATE_CHANGE_WARNING,
  issueDateChangeNeedsConfirmation,
} from "@/lib/documents/invoice-lifecycle";

interface DocItem {
  id: string;
  documentNumber: string;
  documentType: "OFFER" | "ORDER_CONFIRMATION" | "INVOICE";
  status: "ENTWURF" | "OFFEN" | "TEILBEZAHLT" | "BEZAHLT" | "STORNIERT";
  issueDate: string;
  dueDate: string | null;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  paidAmount: number;
  openAmount: number;
  overdue: boolean;
  customerName: string;
  title: string | null;
  calculationId: string;
  orderId: string | null;
  sentAt: string | null;
  canceledAt: string | null;
  cancelOfId: string | null;
  hasPdf: boolean;
  eInvoiceFormat: string | null;
  taxTreatmentLabel?: string | null;
  isReverseCharge?: boolean;
}

interface Summary {
  count: number;
  openSum: number;
  overdueSum: number;
  overdueCount: number;
  revenueOpenCount: number;
  vatSum?: number;
  netSum?: number;
  grossSum?: number;
}

const STATUS_STYLES: Record<DocItem["status"], string> = {
  ENTWURF: "bg-slate-100 text-slate-700",
  OFFEN: "bg-amber-100 text-amber-800",
  TEILBEZAHLT: "bg-blue-100 text-blue-800",
  BEZAHLT: "bg-emerald-100 text-emerald-800",
  STORNIERT: "bg-rose-100 text-rose-800",
};

const STATUS_LABEL: Record<DocItem["status"], string> = {
  ENTWURF: "Entwurf",
  OFFEN: "Offen",
  TEILBEZAHLT: "Teilbezahlt",
  BEZAHLT: "Bezahlt",
  STORNIERT: "Storniert",
};

const TYPE_LABEL: Record<DocItem["documentType"], string> = {
  OFFER: "Angebot",
  ORDER_CONFIRMATION: "Auftragsbest.",
  INVOICE: "Rechnung",
};

export default function RechnungenPage() {
  const [amountMode, setAmountMode] = useAmountMode();
  const [items, setItems] = useState<DocItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("INVOICE");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [payDoc, setPayDoc] = useState<DocItem | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("UEBERWEISUNG");
  const [payNote, setPayNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [cancelDoc, setCancelDoc] = useState<DocItem | null>(null);
  const [sendDoc, setSendDoc] = useState<DocItem | null>(null);
  const [issueDateDoc, setIssueDateDoc] = useState<DocItem | null>(null);
  const [issueDateValue, setIssueDateValue] = useState("");
  const [issueDateConfirmOpen, setIssueDateConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetchJson<{ items: DocItem[]; summary: Summary }>(
      `/api/documents?${params.toString()}`
    );
    if (res.success && res.data) {
      setItems(res.data.items);
      setSummary(res.data.summary);
    }
    setLoading(false);
  }, [type, status, q, from, to]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function openPayment(doc: DocItem) {
    setPayDoc(doc);
    setPayAmount(doc.openAmount.toFixed(2));
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayMethod("UEBERWEISUNG");
    setPayNote("");
  }

  function openIssueDateEditor(doc: DocItem) {
    setIssueDateDoc(doc);
    setIssueDateValue(formatIssueDateInput(doc.issueDate));
  }

  async function saveIssueDate(confirmed = false) {
    if (!issueDateDoc || !issueDateValue) return;
    const needsWarning = issueDateChangeNeedsConfirmation(issueDateDoc);
    if (needsWarning && !confirmed) {
      setIssueDateConfirmOpen(true);
      return;
    }

    setBusy(true);
    const res = await saveJson(
      `/api/documents/${issueDateDoc.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueDate: issueDateValue,
          confirmIssueDateChange: needsWarning ? true : undefined,
        }),
      },
      {
        loading: "Rechnungsdatum wird gespeichert …",
        success: "Rechnungsdatum aktualisiert",
      }
    );
    setBusy(false);
    if (res.success) {
      setIssueDateDoc(null);
      setIssueDateConfirmOpen(false);
      load();
    }
  }

  async function submitPayment() {
    if (!payDoc) return;
    setBusy(true);
    const res = await saveJson(
      `/api/documents/${payDoc.id}/payments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(payAmount),
          paidAt: payDate,
          method: payMethod,
          note: payNote || undefined,
        }),
      },
      { loading: "Zahlung wird erfasst …", success: "Zahlung erfasst" }
    );
    setBusy(false);
    if (res.success) {
      setPayDoc(null);
      load();
    }
  }

  async function submitCancel() {
    if (!cancelDoc) return;
    setBusy(true);
    const res = await saveJson(
      `/api/documents/${cancelDoc.id}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || undefined }),
      },
      { loading: "Storno wird erstellt …", success: "Stornorechnung erstellt" }
    );
    setBusy(false);
    if (res.success) {
      setCancelDoc(null);
      setCancelReason("");
      load();
    }
  }

  async function sendInvoice(doc: DocItem) {
    const res = await saveJson(
      `/api/documents/${doc.id}/send`,
      { method: "POST" },
      { loading: "Rechnung wird gesendet …", success: "Rechnung gesendet" }
    );
    if (res.success) load();
  }

  async function createDunning(doc: DocItem) {
    const res = await saveJson(
      `/api/documents/${doc.id}/dunning`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      { loading: "Mahnung wird erstellt …", success: "Mahnung erstellt" }
    );
    if (res.success) load();
  }

  const totalPrimary = useMemo(
    () =>
      items
        .filter((i) => i.status !== "STORNIERT")
        .reduce(
          (s, i) =>
            s +
            pickAmount(amountMode, {
              net: i.netAmount,
              gross: i.isReverseCharge ? i.netAmount : i.grossAmount,
            }),
          0
        ),
    [items, amountMode]
  );

  return (
    <div>
      <LoadingOverlay open={busy} label="Vorgang läuft …" />

      <div className="flex items-start justify-between gap-3 mb-6">
        <h1 className="min-w-0 text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="h-7 w-7 shrink-0 text-[#0d5c63]" />
          Rechnungen &amp; Belege
          <InfoButton title="Rechnungsübersicht">
            <p>
              Zentrales Register aller Angebote und Rechnungen. Rechnungen speichern
              einen Snapshot zum Rechnungsdatum und werden über einen lückenlosen,
              fortlaufenden Nummernkreis erzeugt (GoBD).
            </p>
            <p className="mt-2">
              Der Umsatz wird dem Monat des Rechnungsdatums zugeordnet – nicht dem
              Speicher- oder Zahlungsdatum (außer in den Finanzeinstellungen auf
              Zahlungseingang umgestellt).
            </p>
            <p className="mt-2">
              Offene Posten = Bruttobetrag minus erfasste Zahlungen. Überfällig =
              offen und Fälligkeitsdatum überschritten.
            </p>
            <p className="mt-2">
              Brutto/Netto ist nur eine Anzeigeoption und ändert keine gespeicherten
              Rechnungsdaten.
            </p>
          </InfoButton>
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0" aria-label="Weitere Aktionen">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <a href="/api/documents/export?format=datev" target="_blank" rel="noreferrer">
                <Download className="h-4 w-4 mr-2" /> DATEV / CSV-Export
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="!p-4">
          <p className="text-xs text-slate-500">Offene Posten</p>
          <p className="text-xl font-bold text-amber-700">{formatEuro(summary?.openSum ?? 0)}</p>
          <p className="text-xs text-slate-400">{summary?.revenueOpenCount ?? 0} Rechnungen</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-500">Überfällig</p>
          <p className="text-xl font-bold text-rose-700">{formatEuro(summary?.overdueSum ?? 0)}</p>
          <p className="text-xs text-slate-400">{summary?.overdueCount ?? 0} überfällig</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-500">
            Summe Liste ({amountModeLabel(amountMode).toLowerCase()})
          </p>
          <p className="text-xl font-bold text-slate-900">{formatEuro(totalPrimary)}</p>
          <p className="text-xs text-slate-400">
            USt {formatEuro(summary?.vatSum ?? 0)}
            {amountMode === "gross"
              ? ` · Netto ${formatEuro(summary?.netSum ?? 0)}`
              : ` · Brutto ${formatEuro(summary?.grossSum ?? 0)}`}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-500">Belege gesamt</p>
          <p className="text-xl font-bold text-slate-900">{summary?.count ?? 0}</p>
        </Card>
      </div>

      <Card className="!p-4 mb-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Belegnummer oder Kunde suchen …"
              className="h-10 pl-9"
            />
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <AmountModeToggle mode={amountMode} onChange={setAmountMode} />
            <span className="text-[11px] text-slate-400">Nur Anzeige</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label className="text-xs">Typ</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="">Alle</option>
              <option value="INVOICE">Rechnungen</option>
              <option value="OFFER">Angebote</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="">Alle</option>
              <option value="OFFEN">Offen</option>
              <option value="TEILBEZAHLT">Teilbezahlt</option>
              <option value="BEZAHLT">Bezahlt</option>
              <option value="STORNIERT">Storniert</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Von</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-full"
            />
          </div>
          <div>
            <Label className="text-xs">Bis</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-full"
            />
          </div>
        </div>
        {(from || to) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Zeitraum zurücksetzen
          </Button>
        )}
      </Card>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden mb-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Wird geladen …
          </div>
        ) : items.length === 0 ? (
          <Card className="!p-6 text-center text-sm text-slate-500">Keine Belege gefunden.</Card>
        ) : (
          items.map((doc) => {
            const isInvoice = doc.documentType === "INVOICE";
            const open = isInvoice && doc.status !== "STORNIERT" && doc.openAmount > 0;
            return (
              <Card key={doc.id} className="!p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-slate-500">{doc.documentNumber}</p>
                    <p className="font-medium text-slate-900 truncate">{doc.customerName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {TYPE_LABEL[doc.documentType]} · {formatDate(doc.issueDate)}
                    </p>
                  </div>
                  <Badge className={STATUS_STYLES[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{amountModeLabel(amountMode)}</span>
                  <span className="font-semibold tabular-nums">
                    {formatEuro(
                      pickAmount(amountMode, {
                        net: doc.netAmount,
                        gross: doc.isReverseCharge ? doc.netAmount : doc.grossAmount,
                      })
                    )}
                  </span>
                </div>
                {isInvoice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Offen</span>
                    <span className={doc.overdue ? "font-medium text-rose-600" : ""}>
                      {formatEuro(doc.openAmount)}
                    </span>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button asChild variant="outline" size="sm" className="min-h-10 flex-1">
                    <a href={`/api/documents/${doc.id}?format=html`} target="_blank" rel="noreferrer">
                      Ansehen
                    </a>
                  </Button>
                  <CanAccess permission="invoices.payments">
                    {open && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-10 flex-1 text-emerald-700"
                        onClick={() => openPayment(doc)}
                      >
                        Zahlung
                      </Button>
                    )}
                  </CanAccess>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-10 shrink-0"
                        aria-label="Weitere Aktionen"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem asChild>
                        <a href={`/api/documents/${doc.id}/pdf`} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4 mr-2" /> PDF herunterladen
                        </a>
                      </DropdownMenuItem>
                      {isInvoice && (
                        <DropdownMenuItem asChild>
                          <a href={`/api/documents/${doc.id}/einvoice`} target="_blank" rel="noreferrer">
                            <FileCode2 className="h-4 w-4 mr-2" /> E-Rechnung (XML)
                          </a>
                        </DropdownMenuItem>
                      )}
                      <CanAccess permission="invoices.write">
                        {isInvoice && doc.status !== "STORNIERT" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openIssueDateEditor(doc)}>
                              <CalendarDays className="h-4 w-4 mr-2" /> Rechnungsdatum ändern
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSendDoc(doc)}>
                              <Send className="h-4 w-4 mr-2" /> Per E-Mail senden
                            </DropdownMenuItem>
                            {doc.overdue && (
                              <DropdownMenuItem
                                className="text-amber-700"
                                onClick={() => createDunning(doc)}
                              >
                                <BellRing className="h-4 w-4 mr-2" /> Mahnung erstellen
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-700 focus:text-rose-700"
                              onClick={() => setCancelDoc(doc)}
                            >
                              <Ban className="h-4 w-4 mr-2" /> Stornieren
                            </DropdownMenuItem>
                          </>
                        )}
                      </CanAccess>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Card className="!p-0 overflow-x-auto hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-3 py-2">Nr.</th>
              <th className="px-3 py-2">Typ</th>
              <th className="px-3 py-2">Kunde</th>
              <th className="px-3 py-2">Datum</th>
              <th className="px-3 py-2">Fällig</th>
              <th className="px-3 py-2 text-right">{amountModeLabel(amountMode)}</th>
              <th className="px-3 py-2 text-right">Offen</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  Wird geladen …
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  Keine Belege gefunden.
                </td>
              </tr>
            ) : (
              items.map((doc) => {
                const isInvoice = doc.documentType === "INVOICE";
                const open = isInvoice && doc.status !== "STORNIERT" && doc.openAmount > 0;
                return (
                  <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      <div>{doc.documentNumber}</div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] font-sans font-normal text-[#0d5c63]">
                        <Link href={`/dashboard/kalkulation/${doc.calculationId}`}>Kalkulation</Link>
                        {doc.orderId && (
                          <Link href={`/dashboard/auftraege/${doc.orderId}`}>Auftrag</Link>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {doc.documentType === "INVOICE" ? (
                        <Receipt className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                      ) : (
                        <FileText className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                      )}
                      {TYPE_LABEL[doc.documentType]}
                    </td>
                    <td className="px-3 py-2">{doc.customerName}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-left hover:text-[#0d5c63] hover:underline disabled:hover:no-underline disabled:hover:text-inherit"
                        disabled={doc.documentType !== "INVOICE" || doc.status === "STORNIERT"}
                        onClick={() => {
                          if (doc.documentType === "INVOICE" && doc.status !== "STORNIERT") {
                            openIssueDateEditor(doc);
                          }
                        }}
                        title={
                          doc.documentType === "INVOICE" && doc.status !== "STORNIERT"
                            ? "Rechnungsdatum ändern"
                            : undefined
                        }
                      >
                        {formatDate(doc.issueDate)}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {doc.dueDate ? (
                        <span className={doc.overdue ? "text-rose-600 font-medium" : ""}>
                          {formatDate(doc.dueDate)}
                          {doc.overdue && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div>
                        {formatEuro(
                          pickAmount(amountMode, {
                            net: doc.netAmount,
                            gross: doc.isReverseCharge ? doc.netAmount : doc.grossAmount,
                          })
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        {amountMode === "gross"
                          ? `Netto ${formatEuro(doc.netAmount)}`
                          : `Brutto ${formatEuro(doc.grossAmount)}`}
                        {` · USt ${formatEuro(doc.vatAmount)}`}
                        {doc.taxTreatmentLabel ? ` · ${doc.taxTreatmentLabel}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {isInvoice ? formatEuro(doc.openAmount) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={STATUS_STYLES[doc.status]}>
                        {STATUS_LABEL[doc.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/api/documents/${doc.id}?format=html`}
                          target="_blank"
                          rel="noreferrer"
                          title="Ansehen / Drucken"
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </a>
                        <CanAccess permission="invoices.payments">
                          {open && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-700"
                              title="Zahlung erfassen"
                              onClick={() => openPayment(doc)}
                            >
                              <Euro className="h-4 w-4" />
                            </Button>
                          )}
                        </CanAccess>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Weitere Aktionen"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem asChild>
                              <a
                                href={`/api/documents/${doc.id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="h-4 w-4 mr-2" /> PDF herunterladen
                              </a>
                            </DropdownMenuItem>
                            {isInvoice && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={`/api/documents/${doc.id}/einvoice`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <FileCode2 className="h-4 w-4 mr-2" /> E-Rechnung (XML)
                                </a>
                              </DropdownMenuItem>
                            )}
                            <CanAccess permission="invoices.write">
                              {isInvoice && doc.status !== "STORNIERT" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openIssueDateEditor(doc)}>
                                    <CalendarDays className="h-4 w-4 mr-2" /> Rechnungsdatum ändern
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setSendDoc(doc)}>
                                    <Send className="h-4 w-4 mr-2" /> Per E-Mail senden
                                  </DropdownMenuItem>
                                  {doc.overdue && (
                                    <DropdownMenuItem
                                      className="text-amber-700"
                                      onClick={() => createDunning(doc)}
                                    >
                                      <BellRing className="h-4 w-4 mr-2" /> Mahnung erstellen
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-rose-700 focus:text-rose-700"
                                    onClick={() => setCancelDoc(doc)}
                                  >
                                    <Ban className="h-4 w-4 mr-2" /> Stornieren
                                  </DropdownMenuItem>
                                </>
                              )}
                            </CanAccess>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Zahlung erfassen */}
      <Dialog open={!!payDoc} onOpenChange={(o) => !o && setPayDoc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zahlung erfassen – {payDoc?.documentNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Betrag (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">
                Offen: {formatEuro(payDoc?.openAmount ?? 0)}
              </p>
            </div>
            <div>
              <Label>Datum</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <Label>Zahlungsart</Label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="block w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              >
                <option value="UEBERWEISUNG">Überweisung</option>
                <option value="BAR">Bar</option>
                <option value="KARTE">Karte</option>
                <option value="LASTSCHRIFT">Lastschrift</option>
                <option value="PAYPAL">PayPal</option>
                <option value="SONSTIGES">Sonstiges</option>
              </select>
            </div>
            <div>
              <Label>Notiz (optional)</Label>
              <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDoc(null)} disabled={busy}>
              Abbrechen
            </Button>
            <Button variant="action" onClick={submitPayment} disabled={busy}>
              {busy ? "Speichern…" : "Zahlung speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Storno */}
      <Dialog open={!!cancelDoc} onOpenChange={(o) => !o && setCancelDoc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechnung stornieren – {cancelDoc?.documentNumber}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Es wird eine Stornorechnung mit eigener Nummer und negativen Beträgen
            erstellt. Die Originalrechnung bleibt erhalten (GoBD), wird aber als
            storniert markiert.
          </p>
          <div>
            <Label>Grund</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="z. B. Fehlerhafte Position, Doppelberechnung …"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDoc(null)} disabled={busy}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={submitCancel} disabled={busy}>
              {busy ? "Storniere…" : "Stornorechnung erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Rechnungsdatum ändern */}
      <Dialog
        open={!!issueDateDoc && !issueDateConfirmOpen}
        onOpenChange={(o) => {
          if (!o) setIssueDateDoc(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechnungsdatum – {issueDateDoc?.documentNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-issue-date">Rechnungsdatum</Label>
            <Input
              id="edit-issue-date"
              type="date"
              value={issueDateValue}
              onChange={(e) => setIssueDateValue(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Der Umsatz erscheint im Monat dieses Datums (Dashboard, Finanz- und
              Umsatzübersicht).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDateDoc(null)} disabled={busy}>
              Abbrechen
            </Button>
            <Button
              variant="action"
              onClick={() => saveIssueDate(false)}
              disabled={busy || !issueDateValue}
            >
              {busy ? "Speichern…" : "Datum speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={issueDateConfirmOpen}
        onOpenChange={setIssueDateConfirmOpen}
        title="Rechnungsdatum ändern?"
        description={ISSUE_DATE_CHANGE_WARNING}
        confirmLabel="Trotzdem ändern"
        cancelLabel="Abbrechen"
        variant="action"
        icon={<AlertTriangle className="h-5 w-5" />}
        loading={busy}
        onConfirm={() => saveIssueDate(true)}
      />

      <ConfirmDialog
        open={sendDoc !== null}
        onOpenChange={(open) => {
          if (!open) setSendDoc(null);
        }}
        title="Rechnung senden?"
        description={
          sendDoc
            ? `Rechnung ${sendDoc.documentNumber} wird per E-Mail an den Kunden gesendet.`
            : ""
        }
        confirmLabel="Senden"
        cancelLabel="Abbrechen"
        variant="action"
        icon={<Send className="h-5 w-5" />}
        onConfirm={async () => {
          if (sendDoc) {
            const doc = sendDoc;
            setSendDoc(null);
            await sendInvoice(doc);
          }
        }}
      />
    </div>
  );
}
