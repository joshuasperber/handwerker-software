# Taxfix – konzeptionelle Prüfung (keine Integration)

## Kurzfazit

**Aktuell nicht sinnvoll integrieren.** Zuerst Steuerberater-Export (CSV) und ggf. DATEV ausbauen.

## Warum zurückhaltend?

| Frage | Einschätzung |
|-------|----------------|
| Passende Schnittstelle? | Taxfix richtet sich oft an Steuerberater/Kanzleien, nicht primär an Handwerks-ERP mit Aufträgen, Material und Teams. |
| Welche Daten? | Rechnungen, Ausgaben, Belege, Stammdaten, USt – sensibel und revisionsrelevant. |
| Passend für Handwerk mit Mitarbeitern/Projekten? | Nur teilweise; viele Prozesse (Kalkulation, Stundenzettel, Lager) liegen außerhalb typischer Taxfix-Workflows. |
| DSGVO | Auftragsverarbeitung, AV-Vertrag, Zweckbindung, Löschkonzepte, ggf. Drittland – hoher Aufwand vor erstem Byte. |
| Zustimmung | Explizite Opt-in-Einwilligung + jederzeit widerrufbar; keine stillen Syncs. |

## Sinnvollere Reihenfolge

1. **CSV/PDF-Export** für Steuerberater (jetzt vorbereitet)
2. **DATEV-Export** prüfen (hohe Praxisrelevanz in DE)
3. Optional Beleg-ZIP
4. Taxfix / ELSTER / andere APIs erst bei klarem Kundenbedarf und Partnervertrag

## Empfehlung

Taxfix **später** erneut prüfen, wenn Nutzer aktiv danach fragen und eine dokumentierte API mit AV-Vertrag vorliegt. Bis dahin: Export + Steuerberater bleiben der Standardweg.
