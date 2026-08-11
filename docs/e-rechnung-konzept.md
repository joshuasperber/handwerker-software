# E-Rechnung – Konzept (Stufe 1)

## Ziel

JoMaster erzeugt Rechnungen weiterhin als PDF und kann zusätzlich strukturierte E-Rechnungen exportieren – bewusst, nach Validierung, ohne automatischen E-Mail-Versand.

## Formate

| Format | Umsetzung Stufe 1 | Hinweis |
|--------|-------------------|---------|
| **XRechnung (UBL)** | Ja – EN16931-orientierte UBL 2.1 / Customization XRechnung 3.0 | Separates XML |
| **ZUGFeRD / Factur-X** | Ja – Hybrid-PDF mit eingebetteter `xrechnung.xml` | Profil XRechnung; visuelle PDF via pdf-lib (noch kein vollständiges PDF/A-3) |
| CII BASIC/EN16931 | Später | Für klassisches ZUGFeRD-EN16931-Profil |

## Ablauf

1. Nutzer öffnet **E-Rechnung prüfen/exportieren** (Rechnungen-Liste).
2. App prüft Pflichtdaten am **Snapshot** (GoBD-Stand der Rechnung).
3. Vorschau zeigt Empfänger, Beträge, Format, Fehler und Warnungen.
4. Erst nach Bestätigung: Datei erzeugen, speichern (`eInvoiceFormat`, `eInvoiceStorageKey`, `eInvoiceGeneratedAt`), Download.
5. E-Mail-Versand bleibt separat und sendet nur das visuelle PDF.

## Pflichtdaten (Fehler blockieren Export)

- Verkäufer: Name, Anschrift, USt-ID oder Steuernummer, IBAN
- Käufer: Name, Rechnungsadresse (sonst Ausführungsadresse mit Warnung)
- Rechnung: Nummer, Datum, Positionen, stimmige Summen
- Reverse Charge: Steuerbetrag 0

## Bewusste Grenzen Stufe 1

- Keine externe KoSIT-/Schematron-Validierung
- Kein separates Leistungsdatum im Datenmodell (Warnung; Rechnungsdatum wird genutzt)
- Keine Leitweg-ID / Kundennummer-Pflicht (B2G folgt)
- Kein automatisches Umwandeln alter Rechnungen
- Kein automatischer E-Mail-Versand der E-Rechnung

## Nächste Stufen

1. PDF/A-3 + Factur-X-XMP (echte ZUGFeRD-Konformität)
2. CII-XML alternativ zu UBL
3. Optionales Leistungsdatum/-zeitraum am Beleg
4. Kundennummer / BuyerReference / Leitweg-ID
5. Optionale Anbindung an Validator-Dienste
