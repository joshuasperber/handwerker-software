# Handwerker App – SaaS MVP

Multi-Tenant SaaS-Plattform für kleine und mittlere Handwerksbetriebe mit Online-Buchung, Büro-Dashboard, Monteur-PWA und REST-API.

## Architektur

| Komponente | Technologie |
|---|---|
| Frontend | Next.js 16 / React 19 / Tailwind CSS 4 |
| Backend | Next.js API Routes (REST/JSON) |
| Datenbank | PostgreSQL + Prisma ORM |
| Auth | JWT (httpOnly Cookie), rollenbasiert |
| Dateispeicher | S3-kompatibel (MinIO lokal) |
| Benachrichtigungen | E-Mail (SMTP) + SMS (Twilio) |

## Module

- **Öffentliches Buchungswidget** (`/buchen/[slug]`) – Leistungen, Fragen, Adresse, Fotos, Terminwahl mit Verfügbarkeitsberechnung
- **Büro-Dashboard** (`/dashboard`) – Kunden, Aufträge, Terminkalender, Mitarbeiter, Leistungen, Nachrichten
- **Monteur-PWA** (`/monteur`) – Tagesplan, Status, Checklisten, Arbeitszeit, Material, Fotos, Abschluss
- **REST-API** (`/api/*`) – JSON-Endpunkte für alle Entitäten

## Rollen

| Rolle | Berechtigungen |
|---|---|
| Admin | Vollzugriff, Tenant-Verwaltung |
| Meister | Aufträge, Termine, Mitarbeiter, Leistungen |
| Büro/Disposition | Kunden, Aufträge, Terminplanung, Nachrichten |
| Monteur | Eigener Tagesplan, Auftragserfassung |
| Kunde | Eigene Buchungen (Portal erweiterbar) |

## Statusmodell

`Neue Anfrage` → `Termin gebucht` → `Eingeplant` → `Unterwegs` → `In Arbeit` → `Abgeschlossen` → `Abgerechnet` / `Storniert`

Alle Statusänderungen werden im Audit-Log mit Benutzer und Zeitstempel protokolliert.

## Schnellstart

### 1. Infrastruktur starten

```bash
npm run docker:up
```

Startet PostgreSQL (Port 5432) und MinIO (Port 9000/9001).

### 2. Umgebungsvariablen

```bash
cp .env.example .env
```

### 3. Datenbank einrichten

```bash
npm run setup
```

Oder einzeln (jeweils **ohne** Kommentar am Zeilenende):

```bash
npm run docker:up
npm run db:push
npm run db:seed
```

### 4. Entwicklungsserver

```bash
npm run dev
```

Dann im Browser öffnen: http://localhost:3003

## Demo-Zugänge

| E-Mail | Passwort | Rolle |
|---|---|---|
| admin@demo.de | demo1234 | Admin |
| buero@demo.de | demo1234 | Büro |
| monteur@demo.de | demo1234 | Monteur |

- Buchungswidget: `/buchen/demo`
- Dashboard: `/dashboard`
- Monteur-App: `/monteur`

## Verfügbarkeitsberechnung

Berücksichtigt:
- Tenant-Arbeitszeiten und Mitarbeiter-Arbeitszeiten
- Einsatzgebiet (PLZ-Bereiche)
- Leistungsdauer + Pufferzeiten
- Mitarbeiterqualifikationen
- Bestehende Termine (Konfliktprüfung)

## API-Endpunkte (Auswahl)

```
POST   /api/auth/login
GET    /api/auth/me
GET    /api/public/[slug]
POST   /api/public/[slug]/availability
POST   /api/public/[slug]/book
GET    /api/orders
PATCH  /api/orders/[id]
GET    /api/appointments
PATCH  /api/appointments/[id]
GET    /api/monteur/schedule
GET    /api/audit
```

## Erweiterbarkeit

Vorbereitet für:
- KI-Assistent (Anfrage-Klassifizierung, Foto-Analyse)
- Angebote & Rechnungen
- Wartungsverträge
- Materialverwaltung / Lager
- Kundenportal
- Multi-Tenant Billing

## DSGVO

- Einwilligung bei Online-Buchung (`gdprConsent`)
- Audit-Log für alle relevanten Änderungen
- Mandantentrennung (Multi-Tenant)
- Konfigurierbare Datenschutz-URL pro Tenant

## Widget einbetten

```html
<iframe
  src="https://ihre-domain.de/buchen/demo"
  width="100%"
  height="700"
  frameborder="0"
  style="border: none; border-radius: 12px;"
  title="Termin buchen"
></iframe>
```
