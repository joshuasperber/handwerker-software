# JoMaster – Gesamtdokument

**Stand:** August 2026  
**Produkt:** JoMaster (Handwerker-Software)  
**Codebasis:** `handwerker-app` (Next.js, Prisma/PostgreSQL, Supabase Auth, Multi-Tenant)  
**Zweck:** Interne Weiterentwicklung + kundenfähige Darstellung

Dieses Dokument basiert auf der **tatsächlich vorhandenen Codebasis**. Nicht vorhandene Funktionen werden nicht als fertig dargestellt. Unklare Punkte sind als **offene Klärungspunkte** markiert.

---

# A. Internes Gesamtdokument

## 1. Executive Summary

JoMaster ist eine Multi-Tenant-SaaS für kleine und mittlere Handwerksbetriebe. Die App verbindet **Büro und Disposition**, **mobile Feldarbeit**, **Kalkulation/Angebote/Rechnungen**, **Inventar**, **Projekte** und **Finanzen** in einer Plattform.

Die Kernidee ist ein durchgängiger Prozess von Kunde und Auftrag über Termin, Material und Zeiten bis zu Angebot, Rechnung und betriebswirtschaftlicher Auswertung – ergänzt um einen **Betriebsassistenten (KI)** und eine klare Trennung von **Verwaltungsansicht** (`/dashboard`) und **Arbeitsansicht** (`/monteur`).

**Aktueller Stand:** Der Funktionsumfang ist breit und praxisnah, der Reifegrad jedoch ungleichmäßig. Besonders stark sind Auftrags-/Termin-/Kalkulationskern sowie die rollenbasierte Trennung von Verwaltung und Arbeit. Noch unreif oder teilweise: dynamische Custom-Rollen in der Datenbank, einige Rechnungs-Edge-Cases (z. B. Abschlag/Skonto), Portal-Tiefe und Infra-/Migrationsthemen.

---

## 2. Ziel und Grundidee der App

| Aspekt | Inhalt |
|--------|--------|
| Produktname | JoMaster |
| Zielgruppe | Kleine und mittlere Handwerksbetriebe |
| Kernproblem | Fragmentierte Tools (Zettel, Excel, WhatsApp, getrennte Buchhaltung) |
| Lösung | Eine App für Büro, Monteur und Finanzen |
| Architektur | Next.js App Router, Prisma/PostgreSQL, Supabase Auth, S3-Uploads, Multi-Tenant |

**Öffentliche Einstiege:** Registrierung, Login, Buchungswidget `/buchen/[slug]`, Kundenportal `/kunde`, Gast-Portal `/portal`.

---

## 3. Zielgruppen und Rollen

| Rolle | Startansicht | Kernrechte (Ist) | Passt zur Idee? |
|-------|--------------|------------------|-----------------|
| **ADMIN** | Verwaltung | Vollzugriff, `views.management` + `views.work`, Rollenverwaltung | Ja |
| **BUERO** | Verwaltung | Operative Verwaltung; `roles.manage` nur mit `canManageRoles` | Ja |
| **MEISTER** | Verwaltung | Stark wie Büro inkl. Finanzen/Audit (Legacy) | Ja, Abgrenzung zu Büro unklar |
| **TEAMLEITER** | Arbeitsansicht | Feld + Teamzeiten, Mitarbeiter lesen, Termine | Ja |
| **MONTEUR** | Arbeitsansicht | Feld, Team-Kalender/Kollegen, Anfragen, KI | Ja |
| **AUSHILFE** | Arbeitsansicht | Stark eingeschränkt | Ja, vorbereitet |
| **KUNDE** | `/kunde` | `customer.own` | Vorhanden, Umfang begrenzt |
| **GAST** | `/portal` | Geteilte Aufträge / Nachrichten (Partner) | Ja als Partner-Zugang |

### Ansichtstrennung (Ist)

- **Verwaltung:** Sidebar, desktopfreundlich (`/dashboard`)
- **Arbeit:** Bottom-Navigation – Heute, Aufträge, Zeiten, Assistent, Mehr (`/monteur`)
- Wechsel nur bewusst (Admin/Büro/Meister), nicht über normale Reiter

**Offener Klärungspunkt:** Ob Monteure wirklich alle Betriebtermine sehen sollen (`appointments.read` in der Feldbasis) oder nur Team/eigene – aktuell ist der Team-Kalender betriebsweit nutzbar.

---

## 4. Funktionsübersicht

### 4.1 Verwaltungsansicht

| Bereich | Route | Zustand |
|---------|-------|---------|
| Dashboard / Übersicht | `/dashboard` | funktioniert |
| Aufträge | `/dashboard/auftraege` | funktioniert |
| Projekte | `/dashboard/projekte` | funktioniert (teilweise Komplexität) |
| Termine | `/dashboard/termine` | funktioniert |
| Disposition / Leitstand | `/dashboard/disposition`, `/leitstand` | funktioniert (Leitstand nicht in Sidebar) |
| Eingangsbox | `/dashboard/eingang` | Basis funktioniert |
| Stundenzettel / Team-Stunden | `/dashboard/stundenzettel`, `/stunden` | funktioniert |
| Inventar / Einkauf | `/dashboard/inventar`, `/einkauf` | funktioniert |
| Kalkulation | `/dashboard/kalkulation` | funktioniert |
| Rechnungen | `/dashboard/rechnungen` | funktioniert |
| Umsatz / Finanzübersicht / Ausgaben | `/umsatz`, `/finanzuebersicht`, `/ausgaben` | funktioniert |
| Kunden | `/dashboard/kunden` | funktioniert (Privat/Business) |
| Mitarbeiter | `/dashboard/mitarbeiter` | funktioniert |
| Rollen & Rechte | `/dashboard/rollen` | teilweise (Matrix/Doku, keine Custom-Rollen in DB) |
| Leistungen / Maschinen | `/leistungen`, `/maschinen` | funktioniert |
| Einstellungen | Betrieb, Rechnung, Benachrichtigungen, Sicherheit, System | funktioniert |
| Betriebsassistent | `/dashboard/ki-assistent` | funktioniert |
| Profil / Nachrichten | `/profil`, `/nachrichten` | funktioniert |

### 4.2 Arbeitsansicht

| Tab / Bereich | Route | Zustand |
|---------------|-------|---------|
| Heute | `/monteur/heute` | funktioniert |
| Aufträge | `/monteur/auftraege`, `/auftrag/[id]` | funktioniert |
| Zeiten | `/monteur/zeiten` | funktioniert |
| Assistent | `/monteur/assistent` | funktioniert |
| Mehr | Profil, Nachrichten, Team, Material, Anfrage | funktioniert |
| Team-Kalender | `/monteur/kalender` | funktioniert |
| Team (Kollegen / Aufträge / Partner) | `/monteur/mitarbeiter` | funktioniert |

### 4.3 Portale und Öffentliches

| Bereich | Route | Zustand |
|---------|-------|---------|
| Buchungswidget | `/buchen/[slug]` | vorhanden |
| Kundenportal | `/kunde` | schlank vorhanden |
| Gast-Portal (Partner) | `/portal` | vorhanden (geteilte Aufträge, Nachrichten) |

---

## 5. Modulübersicht mit Detailbeschreibung

### 5.1 Dashboard

- **Zweck:** Kennzahlen und Einstieg in die Verwaltung
- **Rollen:** Admin, Büro, Meister
- **Zustand:** funktioniert; abhängig von Analytics-APIs

### 5.2 Kunden

- **Zweck:** Stammdaten, Adressen (`Property`), Privat/Business, Steuerhinweise
- **Verknüpfung:** Aufträge, Projekte, Rechnungen
- **Zustand:** funktioniert

### 5.3 Aufträge

- **Zweck:** Operativer Kern (Status, Assignees, Phasen, Materialzeilen, Checklisten, Dateien)
- **Statuskette:** Neue Anfrage → Termin gebucht → Eingeplant → Unterwegs → In Arbeit → Abgeschlossen → Abgerechnet / Storniert
- **Zustand:** funktioniert; komplexes Detailformular

### 5.4 Projekte

- **Zweck:** Mehrere Aufträge, Kosten, Notizen und Dateien unter einem Dach
- **Abschlussrechnung:** vorhanden (Aggregate oder pro Auftrag)
- **Zustand:** vorhanden; Feinschliff und Klarheit = offener Klärungspunkt

### 5.5 Termine / Kalender / Disposition

- **Zweck:** Planung, Teamkalender, Fahrzeuge, Teams, Leitstand
- **Zustand:** funktioniert; Arbeitsansicht nutzt denselben Kalenderkern
- **Hinweis:** Leitstand ist implementiert, aber nicht in der Sidebar-Navigation

### 5.6 Kalkulation / Angebote / Rechnungen

- **Zweck:** Kalkulation mit Positionen (Arbeit, Material, Maschinen, Fahrt u. a.); Dokumente als `CalculationDocument` (Angebot / Auftragsbestätigung / Rechnung), Zahlungen, Mahnungen, E-Rechnung-Felder
- **Festpreis / Reverse Charge:** vorhanden
- **Zustand:** Kern funktioniert
- **Lücken:** kein Abschlag/Anzahlung/Teilrechnung/Skonto; E-Rechnung leichtgewichtig (kein vollständiges RC-Tax-Category / kein ZUGFeRD); Mahngebühren nicht als Rechnungsposition

### 5.7 Leistungen

- **Zweck:** Katalog mit Dauer, Fragen, Qualifikationen, Materialvorlagen
- **Zustand:** funktioniert; Basis für Buchung und Aufträge

### 5.8 Inventar / Einkauf

- **Zweck:** Artikel, Lagerorte, Bestände, Bewegungen, Reservierungen, Bestellvorschläge, Lieferungen
- **Zustand:** funktioniert

### 5.9 Maschinen

- **Zweck:** Stammdaten für Kalkulation und Amortisierung
- **Zustand:** vorhanden

### 5.10 Mitarbeiter / Teams / Fahrzeuge

- **Zweck:** Personal, Farben, Qualifikationen, Teams, Absenzen
- **Zustand:** funktioniert; Rollenänderung nur mit `roles.manage`

### 5.11 Stundenzettel

- **Zweck:** Zeiterfassung Auftrag/Tätigkeit; Team-Prüfung
- **Zustand:** funktioniert in Verwaltung und Arbeit

### 5.12 Arbeitsansicht Monteur

- **Zweck:** Tagesplan, Status, Fotos, Material, Zeiten, Team, Kalender, Zusatzanfragen
- **Zustand:** nach Rollen-/Ansichts-Refactor klarer; Bottom-Nav mit maximal fünf Punkten

### 5.13 Finanzübersicht / Umsatz / Ausgaben

- **Zweck:** Umsatz, Ausgaben/Belege, Fixkosten, Steuer-Radar-Logik, Investitionen
- **Zustand:** umfangreich vorhanden
- **Hinweis:** Kennzahlen sind Orientierung, keine Steuerberatung

### 5.14 Betriebsassistent (KI)

- **Zweck:** Chat über App-Daten (Mitarbeiter, Kunden, Aufträge, Material, Termine, offene Rechnungen u. a.)
- **Zustand:** funktioniert mit datengestützten Intents; Empfehlungen unverbindlich; LLM optional (ohne Keys regelbasiert)

### 5.15 Nachrichten / Einladungen / Shares

- **Zweck:** Interne Nachrichten, Einladungen, OrderShare für GAST
- **Zustand:** vorhanden

### 5.16 Rollen & Rechte / Eingangsbox

- **Rollen-Seite:** Übersicht Standardrollen + `canManageRoles` – **keine** freie DB-Rollenmatrix
- **Eingangsbox:** WorkRequests von Monteuren prüfen/umwandeln – Basis vorhanden
- **Zustand:** Standardrollen und Ansichtslogik vorhanden; dynamische Custom-Rollen offen

### 5.17 Profil / Uploads

- **Zweck:** Stammdaten, Passwort, Avatar (S3/Proxy)
- **Zustand:** funktioniert; Feldrollen über `/monteur/profil`

---

## 6. Fachliche Zusammenhänge der App

```text
Kunde
 ├─ Property (Ausführungsadresse)
 ├─ Rechnungsdaten (Business / USt)
 ├─ Auftrag(e)
 │   ├─ Leistungen / Phasen / Checklisten
 │   ├─ Assignees / Team / Fahrzeug
 │   ├─ Termin(e) → Status vor Ort
 │   ├─ TimeEntry (Stundenzettel)
 │   ├─ Materialzeilen → Inventar / Reservierung / Entnahme
 │   ├─ Fotos / Dateien
 │   └─ Kalkulation → Angebot / Rechnung → Zahlung / Mahnung
 ├─ Projekt (optional, bündelt Aufträge / Kosten)
 └─ Nachrichten / Einladungen

Mitarbeiter (Rolle + Rechte)
 ├─ Verwaltungsansicht ODER Arbeitsansicht
 ├─ Team-Kalender / Kollegen / Partner (GAST)
 └─ WorkRequest → Eingangsbox Büro

Maschine / Zone / Overhead → Kalkulation
Ausgabe / Beleg → Finanzübersicht / Gewinn / Steuer-Radar
KI → liest freigegebene App-Daten → Hinweise
```

**Praxisnah:** Das Büro legt Kunde und Auftrag an, plant Termin und Material. Der Monteur sieht den Tag, startet Zeiten und dokumentiert. Das Büro macht daraus Angebot oder Rechnung und sieht Umsatz und Kosten.

---

## 7. Aktueller Entwicklungsstand

| Cluster | Stand |
|---------|-------|
| Multi-Tenant-Kern | produktiv nutzbar |
| Aufträge / Termine / Disposition | stark |
| Kalkulation / Dokumente | stark |
| Inventar / Einkauf | stark |
| Finanzen | stark, aber komplex |
| Arbeitsansicht + Rollen | kürzlich stark verbessert |
| Work Requests / Eingang | Basis |
| Dynamische Custom-Rollen | nicht als DB-Modell |
| Kunden-/Gastportal | schlank |
| Infra / Migrationen | historisch fragile Stellen möglich |

---

## 8. Stärken der App

1. **Durchgängiger Handwerksprozess** statt isolierter Tools  
2. **Zwei Oberflächen** für Büro und Feld – fachlich richtig  
3. **Kalkulation → Dokument → Zahlung** ist modelliert  
4. **Inventar mit Reservierung und Einkauf** ist überdurchschnittlich  
5. **Teamkalender und Disposition** unterstützen echte Planung  
6. **KI mit Datenbindung** (kein reines Halluzinations-Chat)  
7. **Multi-Tenant, Audit und Rechte** als SaaS-Grundlage  
8. **Hohes Zukunftspotenzial** (Steuer-Radar, Automatisierung, Partner)

---

## 9. Schwächen und offene Probleme

### 9.1 Kritische Probleme

| Thema | Hinweis |
|-------|---------|
| Rechte sind codebasiert | Keine echten Custom-Rollen in DB; Rollen-UI = Übersicht |
| Monteure sehen viele Termine | `appointments.read` in Feldbasis – Need-to-know prüfen |
| Migrationshistorie | Ältere fehlgeschlagene Migrationen können Deployments blockieren |
| Finanz-/Rechnungskomplexität | Risiko unklarer Dokumente bei Bedienfehlern |

### 9.2 Wichtige Verbesserungen

| Thema | Hinweis |
|-------|---------|
| Rollen-UI unvollständig | Kein vollständiges „Rechte je Rolle setzen“ |
| Work Requests | Basis; Anhänge/Historie/Fotos nicht vollständig |
| Projekt-Abschlussrechnung | vorhanden, Feinschliff/Klarheit offen |
| Kunden-/Gastportal | begrenzt |
| Teamleiter-Umplanung | ggf. erweitern |
| DE-Rechnungstypen | kein Abschlag / Skonto / Teilrechnung |
| E-Rechnung | leichtgewichtig; RC-Tax-Category und ZUGFeRD fehlen |

### 9.3 Komfort- und UX-Verbesserungen

- Ladefeedback und Klickfeedback ungleich  
- Mobile Verwaltung nutzbar, aber dicht  
- Leitstand in Navigation aufnehmen  
- Bottom-Nav vs. Team-Funktionen klar halten  

---

## 10. Technische und fachliche Risiken

| Risiko | Empfehlung |
|--------|------------|
| Unberechtigter Datenzugriff | Rechte serverseitig halten; Kalenderscope für Monteure ggf. auf Team begrenzen |
| Personenbezogene Daten | Speicherminimierung, Upload-Policies, Aufbewahrung |
| Steuer / Rechnung | UI-Hinweise „keine Steuerberatung“; Steuerberater-Export |
| KI | Nur freigegebene Daten; Logging; keine automatischen Buchungen |
| Doppelabrechnung | Status-Gates, Dokumentnummern, Storno-Workflow prüfen |
| Datei-Uploads | Typenlimits, Tenant-Isolation in S3 |
| Performance | Indizes, Pooler, Listen-Pagination |
| Nachvollziehbarkeit | Audit für Rollen / Rechnungen / Storno ausbauen |

---

## 11. Priorisierte Roadmap

### Priorität 1 – Muss sofort funktionieren

- Login, Sessions, Ansichtsrouting stabil halten  
- Aufträge, Kunden, Termine, Speichern  
- Rechnungen/Dokumente ohne Doppelbugs  
- Stundenzettel  
- Mobile Grundbedienung Arbeitsansicht  
- DB-Migrationen / Deploy-Pfad bereinigen  

### Priorität 2 – Wichtig für professionellen Betrieb

- Rechteverwaltung ausbauen oder klar als Standardrollen kommunizieren  
- Work Requests inkl. Anhänge  
- Projekt-Abschlussrechnung klar machen  
- Inventarpreise / Material in Kalkulation konsistent  
- Teamleiter-Funktionen schärfen  
- Suche vereinheitlichen  

### Priorität 3 – Wettbewerbsvorteile

- KI-Empfehlungen erweitern (ohne Autonomie)  
- Steuer-Radar / Beleghinweise  
- Material-Nachbestellung automatisieren  
- Maschinenhinweise  
- Abschlag / Teilrechnung / Skonto (DE-Handwerk)  

### Priorität 4 – Feinschliff

- UX, Ladezustände, Performance, Dashboard-KPIs, Designkonsistenz  
- Leitstand in Navigation  
- E-Rechnung vertiefen  

---

## 12. Empfehlungen für die nächste Entwicklungsphase

1. **Rechte-Policy entscheiden:** Custom-Rollen in DB *oder* bewusst bei Standardrollen + Flags (`canManageRoles`) bleiben.  
2. **Datensicht Feld:** Kalender/Aufträge für Monteure auf Team vs. Betrieb festlegen.  
3. **Rechnungspfad härten:** Tests für Angebot → Rechnung → Zahlung → Storno.  
4. **Work Requests fertigstellen:** Fotos, Statushistorie, Umwandlung.  
5. **Infra:** Pooler-URL, Migration-Resolve, Monitoring.  
6. **Pilotbetrieb** mit 1–2 Betrieben und Feedback-Backlog.

---

# B. Kundenfähiger Bericht

## JoMaster – Betriebsoftware für Handwerksbetriebe

*(Stand: produktnaher Entwicklungsstand, ehrlich formuliert)*

### Welches Problem lösen wir?

In vielen Betrieben liegen Termine in einem Kalender, Material auf Zetteln, Zeiten in WhatsApp und Rechnungen in einem anderen Programm. JoMaster führt diese Schritte in **einer Anwendung** zusammen – für Büro und Monteure.

### Für wen?

- Geschäftsführung und Büro  
- Disposition / Planung  
- Teamleiter und Monteure vor Ort  
- Optional: eingeladene Partner (Gastzugang) und schlanke Kundenportal-Ansätze  

### Was bietet JoMaster heute?

- **Kunden und Adressen** inkl. Business-Kunden  
- **Aufträge** mit Status, Zuweisung, Checklisten und Dokumentation  
- **Termine und Teamkalender**  
- **Disposition** mit Teams und Fahrzeugen  
- **Mobile Arbeitsansicht** für den Alltag vor Ort  
- **Zeiten** am Auftrag  
- **Material / Inventar** und Einkaufshinweise  
- **Kalkulation**, Angebote und Rechnungen  
- **Projekte** für größere Vorhaben  
- **Finanzübersicht** mit Ausgaben und betriebswirtschaftlichen Kennzahlen  
- **Betriebsassistent**, der Fragen zu Ihren App-Daten beantwortet  

### Wie erleichtert das den Alltag?

Das Büro plant und verrechnet. Der Monteur sieht, was heute ansteht, wo er hin muss, startet Zeiten und dokumentiert. Informationen gehen nicht mehr zwischen Systemen verloren.

### Verwaltungsansicht

Für Planung, Kunden, Finanzen, Mitarbeiter und Einstellungen – übersichtlich am Desktop, mobil grundlegend nutzbar.

### Arbeitsansicht

Für unterwegs: Heute, Aufträge, Zeiten, Assistent, Team – mit Bottom-Navigation, ohne Admin-Overload.

### Zukunft

Weiterentwicklung von Automatisierung, smarter Materialplanung und noch klarerer Rechtefeinheit – ohne den Anspruch, Steuerberatung zu ersetzen.

### Was wir offen sagen

JoMaster ist funktionsstark und wächst schnell. Einzelne Bereiche werden weiter gehärtet (Rechtefeinheit, Dokumenten-Edge-Cases, Portal-Tiefe). Für Pilotkunden eignet sich die App besonders, wenn Büro und Monteure gemeinsam testen und Feedback geben.

---

# C. Priorisierte Aufgabenliste

1. Entscheidung: Kalender-/Auftragssicht Monteur = Team oder gesamter Betrieb  
2. Entscheidung: Custom-Rollen in DB ja/nein  
3. Automatisierte Tests: Rechnung / Storno / Zahlung  
4. Work Requests: Anhänge + Statushistorie  
5. Projekt-Abschlussrechnung UX/Regeln dokumentieren und prüfen  
6. Migration-/Deploy-Hygiene auf Supabase  
7. Pilotbetrieb mit 1–2 Betrieben + Feedback-Backlog  
8. UX: Ladezustände und Fehlermeldungen vereinheitlichen  
9. Leitstand in Sidebar aufnehmen  
10. DE-Rechnungstypen bewerten (Abschlag, Skonto, Teilrechnung)

---

# D. Offene Fragen und Klärungspunkte

1. Sollen Monteure **alle** Termine des Betriebs sehen oder nur Team/eigene?  
2. Brauchen Sie **echte Custom-Rollen** oder reichen Standardrollen + Flags?  
3. Wie tief soll das **Kundenportal** werden (Rechnungen, Termine, Freigaben)?  
4. Soll **GAST/Partner** Aufträge nur lesen oder auch Zeiten/Fotos liefern?  
5. Welche **Steuer-/Exportformate** braucht der Steuerberater verbindlich?  
6. Ist **E-Rechnung** (XRechnung/ZUGFeRD) produktiv Pflicht oder vorbereitet?  
7. Welche Geräte sind Primärziel (iPhone Safari vs. Android)?  
8. Sollen Teamleiter Aufträge **umplanen** dürfen?  
9. Preis-/Einkaufspreise: dürfen Monteure Einkaufspreise sehen?  
10. Pilotkunden: Branche, Betriebsgröße, Wunsch-Startpaket?

---

# Anhang: Technische Kurzreferenz

| Komponente | Technologie |
|------------|-------------|
| Frontend | Next.js / React / Tailwind |
| Backend | Next.js API Routes |
| Datenbank | PostgreSQL + Prisma |
| Auth | Supabase Auth + lokales User-Profil |
| Dateispeicher | S3-kompatibel |
| KI | Regelbasierte Intents + optional LLM (z. B. Groq) |

### Wichtige Rechte für Ansichten

| Permission | Bedeutung |
|------------|-----------|
| `views.management` | Verwaltungsansicht `/dashboard` |
| `views.work` | Arbeitsansicht `/monteur` |
| `canManageRoles` (User-Flag) | Büro darf Rollen/Rechte verwalten |

### Wichtige Domänenmodelle (Auswahl)

`Tenant`, `User`, `Employee`, `Customer`, `Property`, `Order`, `Appointment`, `TimeEntry`, `Calculation`, `CalculationDocument`, `Payment`, `Article`, `StockBalance`, `Project`, `WorkRequest`, `Message`, `Invitation`, `OrderShare`, `Expense`, `AiChatSession`
