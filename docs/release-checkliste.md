# Release-Checkliste

## 1. Isoliertes Staging vorbereiten

- Eigene Supabase-Datenbank und eigene Storage-/SMTP-/SMS-Testzugänge verwenden.
- Staging-Backup oder Snapshot erstellen.
- Alle Befehle einzeln ausführen. `STAGING_PROJECT_REF` zuerst durch die echte,
  20 Zeichen lange Referenz ersetzen. Keine spitzen Klammern (`<` oder `>`) eingeben.
- Das Projekt zuerst verknüpfen und die Sicherheitsmigration als Vorschau prüfen:

```bash
npx supabase login
npx supabase projects list
npx supabase link --project-ref STAGING_PROJECT_REF
npm run db:target
npm run db:security:dry-run
```

`db:target` muss für App-Konfiguration, Datenbank und Supabase CLI dreimal dieselbe
Staging-Referenz anzeigen. Falls `.env` noch auf ein anderes Projekt zeigt, dort zuerst
`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL` und die Supabase-Schlüssel auf
Staging umstellen. `DATABASE_URL` nutzt den Transaction Pooler auf Port 6543;
`DIRECT_URL` den Session Pooler auf Port 5432 fuer Prisma-Migrationen.

- Erst wenn die Vorschau eindeutig das Staging-Projekt und ausschließlich die erwartete
  Sicherheitsmigration zeigt, die Migrationen einzeln ausrollen:

```bash
npm run db:migrate:deploy
npm run db:security:push
npm run db:verify:hardening
```

`db:verify:hardening` muss 10 RLS-Tabellen, 40 Policies, 0 Data-API-Grants,
0 aktive Termine an terminalen Aufträgen und 0 negative offene Bestellmengen melden.

## 2. Anwendung ausrollen und Kernworkflow testen

Die in `.env.example` dokumentierten `E2E_*`-Variablen auf das isolierte Staging
setzen. Danach bewusst den schreibenden Test freigeben:

```bash
E2E_CONFIRM_WRITES=1 npm run test:e2e:staging
```

Der Lauf prüft:

- Admin- und Monteur-Login
- Kunde und Objekt
- Auftrag und Terminzuweisung
- Monteur-Status `UNTERWEGS` → `IN_ARBEIT` → `ABGESCHLOSSEN`
- Start und Ende der Arbeitszeit
- Kalkulation, Rechnung und Vollzahlung
- Datenbank-Health sowie, falls konfiguriert, S3-Health und echten Datei-Upload
- Konfigurationsstatus von SMTP, SMS und Cron

Die erzeugten Datensätze tragen einen `[E2E-…]`-Marker und bleiben zur
Nachvollziehbarkeit im Staging. Staging kann anschließend per Snapshot zurückgesetzt
oder die markierten Datensätze können dort manuell entfernt werden.

## 3. Externe Zustellung manuell bestätigen

Die Systemseite und der E2E-Lauf bestätigen Konfiguration und Erreichbarkeit, aber
keine Zustellung an reale Endgeräte. Vor Produktion deshalb zusätzlich:

- Test-E-Mail über „Einstellungen → Benachrichtigungen“ an eine kontrollierte Mailbox senden.
- Test-SMS an eine kontrollierte Nummer senden; bei `MESSAGING_DRY_RUN=true` zusätzlich
  einen echten Test mit deaktiviertem Dry-Run durchführen.
- Hochgeladene E2E-Datei öffnen und die signierte Download-URL prüfen.
- Einen Cron-Lauf auslösen oder den ersten geplanten Lauf abwarten und den JobRun-Status prüfen.

## 4. Produktion

- Aktuelles Produktionsbackup erstellen und Wiederherstellungspunkt dokumentieren.
- Dieselben Migrationen in derselben Reihenfolge ausrollen.
- `npm run db:verify:hardening` ausführen.
- Anwendung deployen und Health-Check, Login sowie je einen read-only Rollencheck durchführen.
- Den schreibenden E2E-Test nur dann gegen Produktion starten, wenn bewusst Testdaten in
  Produktion gewünscht sind; standardmäßig bleibt er auf Staging beschränkt.
