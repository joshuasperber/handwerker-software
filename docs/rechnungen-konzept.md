# Konzept: Personalisierbare Rechnungen

Stand: Juni 2026 · Betrifft: Angebote & Rechnungen in der Handwerker-App

Dieses Dokument beschreibt das Konzept und die technische Struktur für personalisierbare
Rechnungen. Ein Teil davon ist bereits umgesetzt (siehe „Status“-Markierungen).

---

## 1. Ziel

Rechnungen (und Angebote) sollen professionell aussehen und an das jeweilige Unternehmen
angepasst werden können – Logo, Firmendaten, Bankverbindung, Texte und Zahlungsbedingungen.
Die Pflege erfolgt zentral im Adminbereich; neue Rechnungen verwenden diese Vorlage automatisch.

---

## 2. Datenmodell

### Aktuell (umgesetzt)

Die Personalisierung wird pro Mandant (Tenant) im Modell **`CompanySettings`** gespeichert
(eine Vorlage pro Betrieb = „Standardvorlage“):

| Bereich        | Felder |
|----------------|--------|
| Firmendaten    | `companyName`, `street`, `houseNumber`, `postalCode`, `city`, `phone`*, `email`*, `website`* |
| Logo           | `invoiceLogoUrl` (URL **oder** hochgeladenes Bild als Data-URL); Fallback `Tenant.logoUrl` |
| Steuer         | `taxNumber`, `vatId` |
| Bank           | `bankName`, `iban`, `bic` |
| Zahlung        | `paymentTermsDays` (Default 14) |
| Texte          | `invoiceIntroText`, `invoiceNotes`, `invoiceFooterText` |

\* `phone`, `email`, `website` wurden für dieses Feature neu ergänzt (nullable, additiv).

### Erstellte Dokumente

Erzeugte Rechnungen/Angebote werden als **`CalculationDocument`** gespeichert
(`documentType` = `OFFER` | `ORDER_CONFIRMATION` | `INVOICE`, fortlaufende `documentNumber`
z. B. `RE-2026-0001`, `internalNote`, optional `pdfStorageKey`).

### Empfehlung (noch offen): Unveränderlichkeit bestehender Rechnungen

Aktuell wird die HTML-Rechnung beim Öffnen jeweils **neu aus den aktuellen Einstellungen**
gerendert. Ändert man später z. B. das Logo, sähe eine alte, erneut geöffnete Rechnung anders aus.
Für echte Buchhaltungs-Unveränderlichkeit empfehlen wir:

- Bei der **Rechnungserstellung** einen Snapshot der relevanten Felder (Firmendaten + Texte +
  berechnete Summen) als JSON in `CalculationDocument` ablegen (`templateSnapshotJson`).
- Beim erneuten Anzeigen/„PDF erzeugen“ den Snapshot verwenden statt der Live-Einstellungen.
- Die Standardvorlage gilt damit nur für **neue** Dokumente; bestehende bleiben unverändert.

Dies ist eine additive, nicht-brechende Erweiterung und kann bei Bedarf nachgezogen werden.

---

## 3. Vorlagen-System

- **Eine Standardvorlage pro Betrieb** über `CompanySettings` (umgesetzt). Das deckt den
  gewünschten Fall „mindestens eine Standardvorlage, automatisch für neue Rechnungen“ vollständig ab.
- **Mehrere Vorlagen** (z. B. „Rechnung“, „Angebot Premium“, „Mahnung“) wären als eigenes Modell
  `InvoiceTemplate` (1:n zu Tenant, mit `isDefault`-Flag) denkbar. Empfehlung: erst einführen, wenn
  konkret mehrere Layouts gebraucht werden – sonst unnötige Komplexität.

---

## 4. Variablen (Platzhalter)

In den Textfeldern (Einleitung/Hinweise/Fußzeile) können Platzhalter `{{name}}` verwendet werden,
die beim Erzeugen ersetzt werden.

**Umgesetzt** (in `build-document-html.ts`, Funktion `applyVariables`):

`{{firmenname}}`, `{{kundenname}}`, `{{rechnungsnummer}}`, `{{auftragsnummer}}`, `{{adresse}}`,
`{{gesamtsumme}}`, `{{nettosumme}}`, `{{zahlungsziel}}`, `{{datum}}`

**Als Positionsliste/Tabelle** (Menge, Einzelpreis, Gesamtpreis, Zwischensumme, MwSt.) werden die
Daten bereits strukturiert in die Rechnungstabelle gerendert – nicht als Text-Platzhalter, weil
eine Tabelle die bessere Darstellung ist.

Beispiel:
> „Sehr geehrte/r {{kundenname}}, vielen Dank für Ihren Auftrag {{auftragsnummer}}.“

Erweiterbar (Empfehlung): `{{kundenadresse}}`, `{{bankdaten}}`, `{{ustbetrag}}` – einfach im
`variables`-Objekt ergänzen.

---

## 5. PDF-Erstellung

**Aktueller Ansatz (umgesetzt, bewusst gewählt):**
1. Rechnung wird als **HTML-Template** erzeugt (`buildCustomerDocumentHtml`).
2. Daten/Variablen werden eingesetzt.
3. Das HTML wird in einem neuen Tab geöffnet; über den Button „Als PDF speichern / drucken“
   erzeugt der Browser per Druckdialog ein PDF.

Vorteile: keine zusätzliche Server-Abhängigkeit, funktioniert überall, exakt = Vorschau.

**Optionaler Ausbau (Empfehlung für später):** serverseitige PDF-Erzeugung via Headless-Chromium
(z. B. Puppeteer/Playwright) → PDF in S3 (`pdfStorageKey`) speichern, fester Download-Link,
Voraussetzung für späteren E-Mail-Versand.

---

## 6. E-Mail-Versand (Datenschutz)

- **Beim Erstellen einer Rechnung wird KEINE E-Mail versendet** (umgesetzt – `convert-to-invoice`
  erzeugt nur das Dokument und ändert den Auftragsstatus).
- E-Mail-Versand soll künftig nur durch eine **bewusste, separate Aktion** ausgelöst werden
  (eigener Button „Per E-Mail senden“ mit Bestätigung).

---

## 7. Adminbereich (umgesetzt)

Neuer Bereich **„Rechnungseinstellungen“** (`/dashboard/einstellungen/rechnung`,
Berechtigung `calculations.settings`):

- Eingabefelder für Firmendaten, Steuer, Bank, Zahlungsziel
- **Logo-Upload** (Bild wird client-seitig verkleinert) oder alternativ Logo-URL
- Standard-Einleitungstext, Hinweise, Fußzeile (mit Variablen-Hilfe per „i“-Symbol)
- **Live-Vorschau** der Rechnung mit Beispieldaten (iframe)
- **Speichern mit sichtbarem Feedback** (Toast „gespeichert“ / Fehlermeldung)

---

## 8. Sicherheit & Stabilität

- Firmen- und Bankdaten liegen mandantengetrennt in `CompanySettings`; Schreibzugriff nur mit
  Berechtigung `calculations.settings` (Admin/Meister/Büro). Die API prüft das serverseitig.
- Kein automatischer E-Mail-Versand.
- Bestehende Rechnungen werden nicht automatisch überschrieben (Snapshot-Empfehlung in Abschnitt 2).
- Klare Fehlermeldungen über das einheitliche `ApiResponse`-Format und Toasts.
- Mobil nutzbar: Formular einspaltig, Vorschau unter dem Formular.

---

## 9. Offene Punkte / nächste Schritte (priorisiert)

1. (Optional) Snapshot bei Rechnungserstellung für echte Unveränderlichkeit.
2. (Optional) Bewusster E-Mail-Versand als separate Aktion inkl. Protokoll (`NotificationLog`).
3. (Optional) Serverseitige PDF-Erzeugung + Speicherung in S3.
4. (Optional) Mehrere Vorlagen (`InvoiceTemplate`) inkl. Farben/Schriftgrößen/Layout-Varianten.
