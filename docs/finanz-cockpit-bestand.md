# Finanz-Cockpit – Bestandsaufnahme

Zentrale Oberfläche: `/dashboard/finanzuebersicht` (alias Ausgaben über `?view=ausgaben`).

## Vorhanden (vor/nach dieser Iteration)

| Bereich | Status |
|---------|--------|
| Umsatz / Einnahmen | Ja – Standard **Rechnungsdatum** (`ISSUE_DATE`) |
| Ausgaben + Belege | Ja – Speichern gehärtet |
| Investitionen planen | Ja – unverändert nutzbar |
| Gewinnschätzung | Ja – Einnahmen − Ausgaben |
| Steuer-/Rücklagen-Orientierung | Ja – unverbindlich |
| Finanzprofil | Ja – erweitert |
| Warnungen (Steuer-Radar) | Ja |
| Zeitraumfilter | Ja – inkl. Monat-Navigation & custom |
| CSV-Export Steuerberater | Neu |
| Taxfix | Nur Konzept, **keine** Integration |

## DB-Erweiterungen (Migration `20260811150000_finance_profile_reserve`)

`FinanceSettings`: `reservePercent`, `vatRegistered`, `kleinunternehmer`, `hasTaxAdvisor`, `profileNote`
