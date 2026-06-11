import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocumentSnapshot } from "./snapshot";
import { getVisibleLineItems } from "./line-items";

const TEAL = rgb(13 / 255, 92 / 255, 99 / 255);
const GREY = rgb(0.4, 0.45, 0.5);
const DARK = rgb(0.12, 0.16, 0.2);
const LINE = rgb(0.88, 0.9, 0.92);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Auf WinAnsi (Helvetica) abbildbaren Text erzeugen. */
function sanitize(text: string): string {
  return (text ?? "")
    .replace(/[\u202f\u00a0]/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019\u201a]/g, "'")
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/\u2026/g, "...")
    // alles außerhalb Latin-1 (außer €) entfernen
    .replace(/[^\u0000-\u00ff\u20ac]/g, "");
}

function money(n: number): string {
  return `${n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} \u20ac`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; type: "png" | "jpg" } | null {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const type = match[1].toLowerCase().startsWith("p") ? "png" : "jpg";
  try {
    const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
    return { bytes, type };
  } catch {
    return null;
  }
}

export async function buildDocumentPdf(snapshot: DocumentSnapshot): Promise<Uint8Array> {
  const { calc, company } = snapshot;
  const isInvoice = snapshot.type === "INVOICE";
  const titleText = isInvoice ? "Rechnung" : "Angebot";

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}
  ) => {
    page.drawText(sanitize(s), {
      x,
      y: yy,
      size: opts.size ?? 10,
      font: opts.font ?? font,
      color: opts.color ?? DARK,
    });
  };

  const rightText = (
    s: string,
    rightX: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 10;
    const w = f.widthOfTextAtSize(sanitize(s), size);
    text(s, rightX - w, yy, opts);
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 40) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  // Logo
  const logoUrl = company.invoiceLogoUrl || company.logoUrl;
  if (logoUrl) {
    const img = dataUrlToBytes(logoUrl);
    if (img) {
      try {
        const embedded = img.type === "png" ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes);
        const maxH = 50;
        const scale = Math.min(maxH / embedded.height, 160 / embedded.width, 1);
        const w = embedded.width * scale;
        const h = embedded.height * scale;
        page.drawImage(embedded, { x: MARGIN, y: y - h, width: w, height: h });
        y -= h + 10;
      } catch {
        // Logo nicht einbettbar – ignorieren
      }
    }
  }

  // Titel
  text(titleText, MARGIN, y - 18, { size: 22, font: bold, color: TEAL });
  text(`${snapshot.documentNumber}  ·  ${fmtDate(snapshot.issueDateISO)}`, MARGIN, y - 34, {
    size: 10,
    color: GREY,
  });
  y -= 60;

  // Adressblöcke
  const colRightX = MARGIN + CONTENT_W / 2 + 10;
  let leftY = y;
  let rightY = y;

  text("Auftragnehmer", MARGIN, leftY, { size: 9, font: bold, color: TEAL });
  leftY -= 14;
  const companyLines = [
    company.companyName,
    [company.street, company.houseNumber].filter(Boolean).join(" "),
    [company.postalCode, company.city].filter(Boolean).join(" "),
  ].filter(Boolean) as string[];
  for (const l of companyLines) {
    text(l, MARGIN, leftY, { size: 10 });
    leftY -= 13;
  }

  text("Rechnungsempfänger", colRightX, rightY, { size: 9, font: bold, color: TEAL });
  rightY -= 14;
  const customerName = calc.customer
    ? `${calc.customer.firstName} ${calc.customer.lastName}`
    : "Kunde";
  const customerLines = [customerName];
  const prop = calc.order?.property;
  if (prop) {
    customerLines.push(prop.street, `${prop.zipCode} ${prop.city}`);
  }
  for (const l of customerLines) {
    text(l, colRightX, rightY, { size: 10 });
    rightY -= 13;
  }

  y = Math.min(leftY, rightY) - 16;

  // Optionaler Einleitungstext
  if (company.invoiceIntroText) {
    for (const l of wrap(company.invoiceIntroText, font, 10, CONTENT_W)) {
      ensureSpace(14);
      text(l, MARGIN, y, { size: 10, color: DARK });
      y -= 13;
    }
    y -= 8;
  }

  // Tabelle
  const amountX = PAGE_W - MARGIN;
  text("Beschreibung", MARGIN, y, { size: 9, font: bold, color: TEAL });
  rightText("Betrag (netto)", amountX, y, { size: 9, font: bold, color: TEAL });
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: amountX, y }, thickness: 1.2, color: TEAL });
  y -= 16;

  const lines = getVisibleLineItems(calc);
  for (const item of lines) {
    const labelLines = wrap(item.label, font, 10, CONTENT_W - 110);
    ensureSpace(labelLines.length * 13 + 6);
    labelLines.forEach((ll, idx) => {
      text(ll, MARGIN, y, { size: 10 });
      if (idx === 0) rightText(money(item.amount), amountX, y, { size: 10 });
      y -= 13;
    });
    page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: amountX, y: y + 4 }, thickness: 0.5, color: LINE });
    y -= 6;
  }

  // Summen
  ensureSpace(70);
  y -= 6;
  const sumLabelX = amountX - 200;
  rightText("Nettosumme:", sumLabelX, y, { size: 10, color: GREY });
  rightText(money(calc.netSalesPrice), amountX, y, { size: 10 });
  y -= 15;
  rightText("zzgl. USt:", sumLabelX, y, { size: 10, color: GREY });
  rightText(money(calc.vatAmount), amountX, y, { size: 10 });
  y -= 6;
  page.drawLine({ start: { x: sumLabelX - 10, y }, end: { x: amountX, y }, thickness: 0.8, color: LINE });
  y -= 16;
  rightText("Gesamtbetrag:", sumLabelX, y, { size: 12, font: bold, color: TEAL });
  rightText(money(calc.grossSalesPrice), amountX, y, { size: 12, font: bold, color: TEAL });
  y -= 26;

  // Zahlungsinformationen
  if (isInvoice) {
    const dueDate =
      company.paymentTermsDays != null
        ? new Date(
            new Date(snapshot.issueDateISO).getTime() +
              company.paymentTermsDays * 24 * 60 * 60 * 1000
          )
        : null;
    ensureSpace(60);
    if (dueDate) {
      text(
        `Zahlungsziel: ${dueDate.toLocaleDateString("de-DE")}${
          company.paymentTermsDays ? ` (${company.paymentTermsDays} Tage)` : ""
        }`,
        MARGIN,
        y,
        { size: 10 }
      );
      y -= 14;
    }
    const bank = [
      company.bankName,
      company.iban ? `IBAN ${company.iban}` : "",
      company.bic ? `BIC ${company.bic}` : "",
    ]
      .filter(Boolean)
      .join("  ·  ");
    if (bank) {
      text(`Bankverbindung: ${bank}`, MARGIN, y, { size: 10 });
      y -= 14;
    }
  }

  // Fußzeile
  const taxLine = [
    company.taxNumber ? `Steuernr.: ${company.taxNumber}` : "",
    company.vatId ? `USt-IdNr.: ${company.vatId}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");
  const contactLine = [
    company.phone ? `Tel.: ${company.phone}` : "",
    company.email ?? "",
    company.website ?? "",
  ]
    .filter(Boolean)
    .join("  ·  ");

  const footerY = MARGIN + 4;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 28 },
    end: { x: amountX, y: footerY + 28 },
    thickness: 0.5,
    color: LINE,
  });
  if (contactLine) text(contactLine, MARGIN, footerY + 14, { size: 8, color: GREY });
  if (taxLine) text(taxLine, MARGIN, footerY, { size: 8, color: GREY });

  return pdf.save();
}
