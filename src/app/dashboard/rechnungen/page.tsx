"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

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
  sentAt: string | null;
  canceledAt: string | null;
  cancelOfId: string | null;
  hasPdf: boolean;
  eInvoiceFormat: string | null;
}

interface Summary {
  count: number;
  openSum: number;
  overdueSum: number;
  overdueCount: number;
  revenueOpenCount: number;
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
  const [items, setItems] = useState<DocItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("INVOICE");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const [payDoc, setPayDoc] = useState<DocItem | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("UEBERWEISUNG");
  const [payNote, setPayNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [cancelDoc, setCancelDoc] = useState<DocItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetchJson<{ items: DocItem[]; summary: Summary }>(
      `/api/documents?${params.toString()}`
    );
    if (res.success && res.data) {
      setItems(res.data.items);
      setSummary(res.data.summary);
    }
    setLoading(false);
  }, [type, status, q]);

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
    if (!confirm(`Rechnung ${doc.documentNumber} per E-Mail an den Kunden senden?`)) return;
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

  const totalGross = useMemo(
    () => items.filter((i) => i.status !== "STORNIERT").reduce((s, i) => s + i.grossAmount, 0),
    [items]
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="h-7 w-7 text-[#0d5c63]" />
          Rechnungen &amp; Belege
          <InfoButton title="Rechnungsübersicht">
            <p>
              Zentrales Register aller Angebote und Rechnungen. Rechnungen sind
              unveränderlich (Snapshot zum Erstellzeitpunkt) und werden über einen
              lückenlosen, fortlaufenden Nummernkreis erzeugt (GoBD).
            </p>
            <p className="mt-2">
              Offene Posten = Bruttobetrag minus erfasste Zahlungen. Überfällig =
              offen und Fälligkeitsdatum überschritten.
            </p>
          </InfoButton>
        </h1>
        <a href="/api/documents/export?format=datev" target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> DATEV / CSV-Export
          </Button>
        </a>
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
          <p className="text-xs text-slate-500">Summe (Liste, brutto)</p>
          <p className="text-xl font-bold text-slate-900">{formatEuro(totalGross)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-500">Belege gesamt</p>
          <p className="text-xl font-bold text-slate-900">{summary?.count ?? 0}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <Label className="text-xs">Typ</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="block h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
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
            className="block h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="">Alle</option>
            <option value="OFFEN">Offen</option>
            <option value="TEILBEZAHLT">Teilbezahlt</option>
            <option value="BEZAHLT">Bezahlt</option>
            <option value="STORNIERT">Storniert</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Suche</Label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Belegnummer oder Kunde …"
            className="h-9"
          />
        </div>
      </div>

      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-3 py-2">Nr.</th>
              <th className="px-3 py-2">Typ</th>
              <th className="px-3 py-2">Kunde</th>
              <th className="px-3 py-2">Datum</th>
              <th className="px-3 py-2">Fällig</th>
              <th className="px-3 py-2 text-right">Brutto</th>
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
                    <td className="px-3 py-2 font-mono text-xs">{doc.documentNumber}</td>
                    <td className="px-3 py-2">
                      {doc.documentType === "INVOICE" ? (
                        <Receipt className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                      ) : (
                        <FileText className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                      )}
                      {TYPE_LABEL[doc.documentType]}
                    </td>
                    <td className="px-3 py-2">{doc.customerName}</td>
                    <td className="px-3 py-2">{formatDate(doc.issueDate)}</td>
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
                      {formatEuro(doc.grossAmount)}
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
                        <a
                          href={`/api/documents/${doc.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          title="PDF herunterladen"
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                        {isInvoice && (
                          <a
                            href={`/api/documents/${doc.id}/einvoice`}
                            target="_blank"
                            rel="noreferrer"
                            title="E-Rechnung (XML)"
                          >
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <FileCode2 className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
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
                        <CanAccess permission="invoices.write">
                          {isInvoice && doc.status !== "STORNIERT" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Per E-Mail senden"
                                onClick={() => sendInvoice(doc)}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              {doc.overdue && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-700"
                                  title="Mahnung erstellen"
                                  onClick={() => createDunning(doc)}
                                >
                                  <BellRing className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-rose-700"
                                title="Stornieren"
                                onClick={() => setCancelDoc(doc)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </CanAccess>
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
    </div>
  );
}
