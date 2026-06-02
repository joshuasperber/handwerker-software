export type SpecBlock =
  | { type: "paragraph"; text: string }
  | { type: "lead"; text: string }
  | { type: "callout"; title?: string; text: string; variant?: "decision" | "info" | "warning" }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "ampel"; items: { color: "green" | "yellow" | "red" | "gray"; label: string }[] }
  | { type: "cards"; items: { title: string; subtitle?: string; body: string }[] }
  | { type: "checklist"; items: string[] };

export interface SpecSection {
  id: string;
  number: string;
  title: string;
  navTitle?: string;
  subtitle?: string;
  blocks: SpecBlock[];
}

export interface SpecDocument {
  title: string;
  subtitle: string;
  type: string;
  version: string;
  meta: { documentType: string; goal: string };
  leadCallout: SpecBlock;
  sections: SpecSection[];
}

export const specBetriebssystemV1: SpecDocument = {
  title: "Betriebssystem für Baudienstleister, Innenausbau & Elektrohandwerk",
  subtitle:
    "Fachliche und technische Analyse für Aufträge, Tagesübersicht, Rechte, Inventar, Lieferprozesse, Leistungsverzeichnis, Phasenmodell und spätere Plananalyse",
  type: "Spezifikationsanalyse / Produktkonzept",
  version: "1.0",
  meta: {
    documentType: "Spezifikationsanalyse / Produktkonzept",
    goal: "Grundlage für spätere technische Spezifikation und KI-Bauprompt",
  },
  leadCallout: {
    type: "callout",
    variant: "decision",
    title: "Leitentscheidung",
    text: "Die erste Version wird auf einen Baudienstleister für Wohnungssanierung, Innenausbau, Bau- und Dienstleistungen optimiert. Die Architektur wird jedoch so vorbereitet, dass ein etwas größerer Elektrikerbetrieb im nächsten Schritt ohne Systembruch angebunden werden kann.",
  },
  sections: [
    {
      id: "management",
      number: "1",
      title: "Management-Zusammenfassung",
      navTitle: "Zusammenfassung",
      blocks: [
        {
          type: "paragraph",
          text: "Die Anwendung soll als operatives Betriebssystem für einen handwerklichen Bau- und Dienstleistungsbetrieb entstehen. Sie verbindet Tagesplanung, Auftragserstellung, Kunden- und Mitarbeiterverwaltung, Rollen- und Rechtekonzept, Leistungsverzeichnis, Materialbedarf, Inventar, Lieferprozesse, Statusphasen und spätere Plan-/Zeichnungsauswertung.",
        },
        {
          type: "paragraph",
          text: "Die erste Version wird bewusst nicht als kompliziertes ERP-System gebaut. Sie soll im Alltag schnell, klar und mobil nutzbar sein. Gleichzeitig muss die Datenstruktur bereits so sauber sein, dass später größere Betriebe, mehrere Kolonnen, Fahrzeuge, Lagerorte, Baustellenphasen und gewerkespezifische Erweiterungen abgebildet werden können.",
        },
        {
          type: "callout",
          variant: "info",
          title: "Kernprinzip",
          text: "Erst die Arbeit steuerbar machen, dann automatisieren. Tagesübersicht, Aufträge, Mitarbeiter, Kunden, Leistungen und Inventar müssen zuerst zuverlässig funktionieren. KI-Plananalyse und automatische Mengenermittlung werden später auf dieser Basis ergänzt.",
        },
        {
          type: "table",
          headers: ["Betriebstyp", "Version 1: Baudienstleister", "Version 2: Elektrikerbetrieb"],
          rows: [
            ["Typische Arbeiten", "Wohnungssanierung, Innenausbau, Renovierung, Trockenbau, Boden, Türen", "Elektroinstallation, Fertigbauhaus-Ausbau, Schalter, Steckdosen, Verteiler, Leitungen"],
            ["Auftragsstruktur", "Mehrere Phasen, mehrere Gewerke, Materiallisten je Raum", "Norm-/qualifikationsgetrieben, Standardartikel, Pläne und Stücklisten"],
            ["Mitarbeiterlogik", "Kolonnen, Allrounder, Vorarbeiter, Subunternehmer", "Elektriker, Elektrohelfer, Meister, Prüfpflichten"],
            ["Inventar", "Baumaterial, Platten, Holz, Werkzeuge, Maschinen", "Schalterprogramme, Kabel, Dosen, Sicherungen, Prüfgeräte"],
            ["Systemfokus", "Phasen, Materialbedarf, Tagessteuerung, Lieferungen", "Plananalyse, Qualifikationen, Stücklisten, Prüf-/Abnahmeprozesse"],
          ],
        },
      ],
    },
    {
      id: "strategie",
      number: "2",
      title: "Empfohlene Produktstrategie",
      blocks: [
        {
          type: "lead",
          text: "Die App soll modular aufgebaut werden – kein ERP, Baustellen-App, Inventar, Lieferantenplattform und KI-Plananalyse gleichzeitig perfekt, sondern ein belastbares Fundament mit Erweiterungspunkten.",
        },
        {
          type: "list",
          ordered: true,
          items: [
            "Phase 1: Tagesübersicht, Kunden, Mitarbeiter, Rollen, Aufträge, Phasen, Status, einfache Leistungen",
            "Phase 2: Leistungsverzeichnis mit Materialbedarf, Inventar, Lagerorte, Fahrzeugbestände, Materialreservierung",
            "Phase 3: Bestell- und Lieferprozesse, Mindestbestand, Zielbestand, Wareneingang, Lieferstatus",
            "Phase 4: Erweiterte Disposition, Ressourcenplanung, Qualifikationen, Fahrzeug-/Werkzeugzuordnung",
            "Phase 5: Plan-/Zeichnungsanalyse mit manueller Markierung, später KI-Unterstützung",
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Warum diese Reihenfolge?",
          text: "Automatische Materialberechnung funktioniert nur mit sauber definierten Leistungen. Automatische Bestellungen nur mit zuverlässigem Inventar und Reservierungen. KI-Plananalyse nur, wenn erkannte Objekte auf echte Artikel und Materialregeln gemappt werden können. Das Leistungsverzeichnis ist die fachliche Brücke zwischen Auftrag, Inventar, Kalkulation und späterer KI.",
        },
      ],
    },
    {
      id: "dashboard",
      number: "3",
      title: "Tagesübersicht: Betriebs-Cockpit",
      subtitle: "Entscheidungszentrum für Chef, Büro und Meister – nicht nur ein Kalender",
      blocks: [
        {
          type: "table",
          headers: ["Bereich", "Inhalt", "Warum wichtig?"],
          rows: [
            ["Kritische Warnungen", "Aufträge ohne Mitarbeiter, fehlendes Material, überfällige Lieferungen", "Verhindert Stillstand auf Baustellen"],
            ["Heute geplante Aufträge", "Einsätze mit Uhrzeit, Kunde, Adresse, Status, Materialampel", "Operative Tagessteuerung"],
            ["Mitarbeiterstatus", "Verfügbar, unterwegs, beim Kunden, Pause, krank, Urlaub", "Disposition und Umplanung"],
            ["Material & Inventar", "Fehlteile, Reservierungen, Lagerwarnungen, Fahrzeugbestand", "Kolonnen vorbereitet halten"],
            ["Lieferungen", "Bestellt, versendet, angekommen, verspätet, zugehöriger Auftrag", "Lieferabhängige Aufträge steuern"],
            ["Offene Entscheidungen", "Freigaben, Rückfragen, Nachträge, Terminbestätigungen", "Chef/Büro weiß, was entschieden werden muss"],
            ["Nächste 7 Tage", "Bald kritische Aufträge, Materialprüfung, Personalengpässe", "Frühwarnsystem statt reaktiver Stress"],
          ],
        },
        {
          type: "cards",
          items: [
            { title: "Kritisch", subtitle: "Pflichtfelder", body: "Warnungstyp, Auftrag, Verantwortlicher, Frist, Priorität, Ursache · Aktionen: öffnen, zuweisen, bestellen, kontaktieren" },
            { title: "Heute", subtitle: "Pflichtfelder", body: "Zeit, Titel, Kunde, Einsatzort, Mitarbeiter, Phase, Status, Materialampel · Route, Status ändern, umplanen" },
            { title: "Mitarbeiter", subtitle: "Pflichtfelder", body: "Name, Rolle, aktueller Auftrag, Status, nächste Aufgabe · Anrufen, Nachricht, zuweisen" },
            { title: "Inventarwarnungen", subtitle: "Pflichtfelder", body: "Artikel, verfügbar, reserviert, Mindestbestand · Bestellung, Lagerort, Ersatzartikel" },
            { title: "Lieferungen", subtitle: "Pflichtfelder", body: "Lieferant, Bestellung, ETA, Auftrag, Status · Wareneingang, Verzug melden" },
            { title: "Offene Entscheidungen", subtitle: "Pflichtfelder", body: "Entscheidung, Auftrag, Vorschlag, Risiko · Genehmigen, ablehnen, delegieren" },
          ],
        },
        {
          type: "ampel",
          items: [
            { color: "green", label: "Grün – Alles vorbereitet" },
            { color: "yellow", label: "Gelb – Beobachten" },
            { color: "red", label: "Rot – Blockierend" },
            { color: "gray", label: "Grau – Erledigt / nicht relevant" },
          ],
        },
        {
          type: "table",
          headers: ["Farbe", "Bedeutung", "Beispiel"],
          rows: [
            ["Grün", "Alles vorbereitet", "Mitarbeiter, Material, Termin, Kundenbestätigung"],
            ["Gelb", "Beobachten", "Material knapp, Kunde noch nicht bestätigt, Lieferung heute"],
            ["Rot", "Blockierend", "Kein Mitarbeiter, Material fehlt, Lieferung überfällig"],
            ["Grau", "Nicht relevant / erledigt", "Abgeschlossen, verbucht, Entscheidung erledigt"],
          ],
        },
      ],
    },
    {
      id: "auftraege",
      number: "4",
      title: "Auftragsverwaltung",
      blocks: [
        {
          type: "paragraph",
          text: "Ein Auftrag muss mehr sein als ein Termin. Für Baudienstleister sind Aufträge oft mehrstufig, materialabhängig und teambezogen. Für Elektriker zusätzlich Qualifikationen, Prüfungen, Pläne und Stücklisten.",
        },
        {
          type: "table",
          headers: ["Schritt", "Ziel", "Pflichtfelder / Fragen"],
          rows: [
            ["1. Auftragstyp", "Grundlogik bestimmen", "Renovierung, Innenausbau, Reparatur, Montage, Besichtigung, Notdienst"],
            ["2. Kunde & Objekt", "Kunde und Einsatzort trennen", "Kunde, Objekt, Adresse, Ansprechpartner, Zugang, Etage, Schlüssel"],
            ["3. Beschreibung", "Problem verstehen", "Was? Wo? Fotos? Räume? Dringlichkeit?"],
            ["4. Leistung wählen", "Standardisierte Leistung laden", "Leistungsverzeichnis, Dauer, Materialvorschlag, Checkliste"],
            ["5. Phasen erzeugen", "Auftrag strukturieren", "Besichtigung, Planung, Material, Ausführung, Abnahme"],
            ["6. Material prüfen", "Ausführbarkeit sichern", "Bedarf, Bestand, Reservierung, Fehlteile, Bestellvorschlag"],
            ["7. Mitarbeiter planen", "Ressourcen zuweisen", "Qualifikation, Verfügbarkeit, Fahrzeug, Kolonne"],
            ["8. Freigabe", "Startklar machen", "Kunde, Termin, Material, Personal, Checkliste, Risiko, Preis"],
          ],
        },
        {
          type: "table",
          headers: ["Feld", "Typ", "Beschreibung"],
          rows: [
            ["order_number", "String", "Lesbare Nummer, z. B. A-2026-000124"],
            ["title", "String", "Kurzer Auftragstitel"],
            ["order_type", "Enum", "Renovierung, Innenausbau, Reparatur, Elektro, Besichtigung, …"],
            ["customer_id / site_id", "UUID", "Kunde und Einsatzort getrennt"],
            ["priority", "Enum", "niedrig, normal, hoch, notfall"],
            ["current_status", "Enum", "Aktueller Hauptstatus"],
            ["completion_result", "Enum", "Erledigt, teilweise, nicht begonnen, Folgetermin"],
            ["material_status", "Enum", "nicht geprüft, vollständig, teilweise, fehlt, bestellt"],
            ["customer_confirmation_status", "Enum", "offen, bestätigt, abgesagt"],
          ],
        },
        {
          type: "table",
          headers: ["Auftragstyp V1", "Typische Phasen", "Typische Materialien"],
          rows: [
            ["Wohnungssanierung", "Besichtigung, Angebot, Demontage, Ausbau, Abnahme", "Platten, Holz, Farbe, Boden, Türen, Werkzeuge"],
            ["Innenausbau", "Aufmaß, Vorfertigung, Montage, Abnahme", "Holz, Profile, Platten, Kleber, Beschläge"],
            ["Reparatur/Nacharbeit", "Analyse, Materialprüfung, Ausführung", "Ersatzteile, Verbrauchsmaterial"],
            ["Besichtigung/Aufmaß", "Termin, Erfassung, Angebot", "Messwerkzeug, Fotos, Raumdaten"],
          ],
        },
        {
          type: "table",
          headers: ["Elektro-Erweiterung (V2)", "Vorbereitung in V1"],
          rows: [
            ["Schalter, Steckdosen, Leuchten zählen", "Leistungsverzeichnis mit Stücklisten, später Planmarkierungen"],
            ["Verteiler und Schutzorgane", "Artikelkategorien, Qualifikationen, Prüfpflichten"],
            ["Fertigbauhaus-Ausbau", "Phasen-/Raumlogik, Materialpakete je Grundriss"],
            ["Größerer Betrieb", "Rollen, Teams, Kolonnen, Lagerorte, Fahrzeuge von Anfang an modellieren"],
          ],
        },
      ],
    },
    {
      id: "kunden",
      number: "5",
      title: "Kunden- und Objektverwaltung",
      blocks: [
        {
          type: "paragraph",
          text: "Kunde und Einsatzort müssen getrennt werden. Ein Kunde kann mehrere Objekte haben, ein Objekt mehrere Aufträge – wichtig für Hausverwaltungen, gewerbliche Kunden und Sanierungsprojekte.",
        },
        {
          type: "table",
          headers: ["Entity", "Wichtige Felder", "Hinweise"],
          rows: [
            ["Customer", "Typ, Name/Firma, Ansprechpartner, Kontakt, Rechnungsadresse, DSGVO", "Privat, Geschäft, Hausverwaltung, öffentlich"],
            ["Site/Object", "Adresse, Etage, Zugang, Parken, Schlüssel, Fotos", "Mehrere Objekte pro Kunde"],
            ["ContactPerson", "Name, Rolle, Telefon, E-Mail, bevorzugte Kommunikation", "Mehrere Ansprechpartner möglich"],
            ["CustomerHistory", "Aufträge, Angebote, Rechnungen, Reklamationen", "Servicequalität, Wiederholaufträge"],
          ],
        },
      ],
    },
    {
      id: "mitarbeiter",
      number: "6",
      title: "Mitarbeiter, Teams und Qualifikationen",
      blocks: [
        {
          type: "paragraph",
          text: "Mitarbeiter sind mehr als Benutzerkonten. Für die Disposition müssen Verfügbarkeit, Qualifikation, Fahrzeuge, Werkzeuge und Rechte bekannt sein.",
        },
        {
          type: "table",
          headers: ["Bereich", "Felder / Funktionen"],
          rows: [
            ["Stammdaten", "Name, Telefon, E-Mail, Rolle, aktiv/inaktiv, Personalnummer optional"],
            ["Arbeitszeit", "Regelarbeitszeiten, Urlaub, Krankheit, Abwesenheiten"],
            ["Qualifikation", "Gewerk, Meister, Vorarbeiter, Elektrofachkraft, Helfer, Prüfberechtigung"],
            ["Team/Kolonne", "Teamzuordnung, Vorarbeiter, Mitglieder, Standardfahrzeug"],
            ["Ressourcen", "Fahrzeug, Standardwerkzeuge, persönliche Ausrüstung"],
            ["App-Rechte", "Preise sehen, Material buchen, abschließen, Fotos, Nachträge"],
            ["Einsatzlogik", "Verfügbar, unterwegs, beim Kunden, Pause, abgeschlossen"],
          ],
        },
      ],
    },
    {
      id: "rechte",
      number: "7",
      title: "Rollen- und Rechtekonzept",
      blocks: [
        {
          type: "paragraph",
          text: "Kombination aus Rollen und Einzelrechten: Chef steuert Mitarbeiter, verteilt Aufträge und schützt sensible Informationen wie Gewinn, Einkaufspreise und Kalkulationsparameter.",
        },
        {
          type: "table",
          headers: ["Rolle", "Darf", "Darf nicht standardmäßig"],
          rows: [
            ["Chef / Inhaber", "Alles, Rechte vergeben, Preise/Kalkulation, Rechnungen freigeben", "—"],
            ["Büro / Disposition", "Kunden, Aufträge, Termine, Materialstatus, Angebote vorbereiten", "Gewinnparameter, ESt-Logik, Margen ändern"],
            ["Meister / Projektleiter", "Phasen, Materialbedarf, fachliche Einteilung, Abnahme", "Globale Rechte, Fixkosten ändern"],
            ["Monteur", "Eigene Aufträge, Checklisten, Zeiten, Fotos, Materialentnahme", "Preise, Gewinn, fremde Kundendaten"],
            ["Lager / Einkauf", "Artikel, Bestände, Bestellungen, Wareneingang", "Rechnungen freigeben, Gewinn sehen"],
            ["Subunternehmer", "Zugewiesene Aufgaben, Dokumentation, Zeiten", "Interne Daten, Inventar gesamt, Preise"],
          ],
        },
        {
          type: "table",
          headers: ["Einzelrecht", "Beschreibung"],
          rows: [
            ["can_view_prices", "Verkaufspreise sehen"],
            ["can_view_purchase_prices", "Einkaufspreise sehen"],
            ["can_view_profit", "Gewinn/Marge sehen"],
            ["can_edit_calculation_settings", "Kalkulationsparameter ändern"],
            ["can_create_orders", "Aufträge anlegen"],
            ["can_assign_staff", "Mitarbeiter zuweisen"],
            ["can_manage_inventory", "Inventar ändern"],
            ["can_reserve_material", "Material reservieren"],
            ["can_order_material", "Bestellungen auslösen"],
            ["can_close_jobs", "Aufträge abschließen"],
            ["can_approve_invoices", "Rechnungen freigeben"],
            ["can_manage_service_catalog", "Leistungsverzeichnis bearbeiten"],
          ],
        },
      ],
    },
    {
      id: "status",
      number: "8",
      title: "Statusmodell und Auftragsphasen",
      blocks: [
        {
          type: "table",
          headers: ["Hauptstatus", "Bedeutung", "Typische Folgeaktion"],
          rows: [
            ["new", "Auftrag angelegt", "Prüfen und planen"],
            ["checked", "Fachlich geprüft", "Material und Termin planen"],
            ["planned", "Termin/Mitarbeiter gesetzt", "Material freigeben"],
            ["material_check", "Material wird geprüft", "Bestand/Bestellung prüfen"],
            ["ready", "Startklar", "Monteur kann losfahren"],
            ["on_the_way", "Unterwegs", "Kunde informieren optional"],
            ["in_progress", "Läuft", "Zeiten, Fotos, Material erfassen"],
            ["paused", "Unterbrochen", "Grund erfassen, Wiedervorlage"],
            ["partially_completed", "Teilweise erledigt", "Folgetermin, Fehlteile"],
            ["completed", "Fertig", "Abnahme, Rechnung"],
            ["not_executable", "Nicht ausführbar", "Grund, neue Planung"],
            ["cancelled / rework / invoiced", "Storniert / Nacharbeit / Abgerechnet", "Dokumentieren / Archiv"],
          ],
        },
        {
          type: "table",
          headers: ["completion_result", "Bedeutung", "Beispiel"],
          rows: [
            ["completed", "Alles erledigt", "Tür montiert, Kunde abgenommen"],
            ["partially_completed", "Nicht fertig", "Boden begonnen, Sockelleisten fehlen"],
            ["not_started", "Nicht begonnen", "Kunde nicht da, Zugang fehlt"],
            ["not_possible", "Nicht lösbar wie geplant", "Untergrund ungeeignet"],
            ["requires_follow_up", "Folgetermin nötig", "Abnahme/Nacharbeit"],
            ["requires_material_order", "Teile fehlen", "Spezialteil bestellen"],
            ["customer_not_available", "Kunde verhindert", "Termin neu planen"],
          ],
        },
        {
          type: "table",
          headers: ["Phase", "Baudienstleister", "Elektriker (später)"],
          rows: [
            ["Besichtigung / Aufmaß", "Räume, Maße, Fotos, Kundenwunsch", "Planaufnahme, Verteiler prüfen"],
            ["Planung / Angebot", "Leistungen, Material, Dauer, Preis", "Stücklisten, Stromkreise, Planbezug"],
            ["Materialbestellung", "Baustoffe, Holz, Türen, Boden", "Kabel, Schalterprogramm, Verteiler"],
            ["Vorfertigung", "Zuschnitt, Vormontage", "Vormontage Verteiler/Komponenten"],
            ["Ausführung", "Demontage, Montage, Finish", "Leitungen, Dosen, Schalter, Leuchten"],
            ["Prüfung / Abnahme", "Qualität, Fotos, Unterschrift", "Messung, Prüfprotokoll"],
            ["Rechnung / Abschluss", "Verbrauch verbuchen, Zeiten finalisieren", "Dokumentation und Rechnung"],
          ],
        },
      ],
    },
    {
      id: "leistungen",
      number: "9",
      title: "Leistungsverzeichnis",
      blocks: [
        {
          type: "paragraph",
          text: "Grundlage für Automatisierung: Jede Leistung verbindet Arbeitszeit, Materialbedarf, Werkzeuge, Maschinen, Qualifikation, Checklisten und Preislogik.",
        },
        {
          type: "table",
          headers: ["Feld", "Typ", "Beschreibung"],
          rows: [
            ["name / trade / category", "String / Enum", "Name, Gewerk, Unterkategorie"],
            ["default_duration_hours", "Decimal", "Standarddauer"],
            ["required_qualification_ids", "Array", "Qualifikationen"],
            ["default_material_list", "Relation", "Standardmaterial/Stückliste"],
            ["checklist_template_id", "UUID", "Standardcheckliste"],
            ["pricing_mode", "Enum", "Aufwand, Festpreis, Pauschale, kalkuliert"],
          ],
        },
        {
          type: "table",
          headers: ["Leistung (Bau)", "Dauer", "Materialvorschlag"],
          rows: [
            ["Wand spachteln und schleifen", "nach m²", "Spachtelmasse, Schleifpapier, Abdeckmaterial"],
            ["Trockenbauwand stellen", "nach m²/lfm", "Profile, Platten, Schrauben, Dämmung"],
            ["Tür montieren", "2–4 h", "Zarge, Türblatt, Montageschaum, Beschläge"],
            ["Boden verlegen", "nach m²", "Belag, Kleber, Sockelleisten"],
            ["Kleinreparatur Innenausbau", "1–3 h", "Schrauben, Dübel, Kleber, Restmaterial"],
          ],
        },
        {
          type: "table",
          headers: ["Leistung (Elektro, später)", "Standardbedarf", "Besonderheit"],
          rows: [
            ["Lichtschalter montieren", "Schalter, Rahmen, Klemmen", "Qualifikation Elektrofachkraft"],
            ["Steckdose setzen", "Dose, Rahmen, Leitung optional", "Plan-/Raumbezug"],
            ["Leuchte anschließen", "Leuchte, Anschlussmaterial", "Funktionstest"],
            ["Verteiler montieren", "Verteiler, LS, FI, Klemmen", "Prüfung/Dokumentation"],
            ["Fertigbauhaus Elektro-Ausbau", "Materialpakete je Grundriss", "Plananalyse relevant"],
          ],
        },
      ],
    },
    {
      id: "inventar",
      number: "10",
      title: "Inventar und Lagerorte",
      blocks: [
        {
          type: "callout",
          variant: "info",
          title: "Verfügbarkeitsformel",
          text: "Verfügbar = Bestand gesamt − reserviert für Aufträge + bestätigte Rückgaben. Bestellt, aber noch nicht geliefert, wird als „im Zulauf“ angezeigt – nicht als verfügbar.",
        },
        {
          type: "table",
          headers: ["Objekt", "Bedeutung"],
          rows: [
            ["Article", "Artikelstamm: Name, Einheit, Kategorie, Lieferant, Bestelllogik"],
            ["StorageLocation", "Hauptlager, Fahrzeug, Mitarbeiter, Baustelle, Defektlager"],
            ["StockBalance", "Bestand eines Artikels an einem Lagerort"],
            ["Reservation", "Reservierung für Auftrag/Phase"],
            ["StockMovement", "Zugang, Abgang, Umbuchung, Verbrauch, Rückgabe, Korrektur"],
            ["PurchaseOrder / Delivery", "Bestellung und Wareneingang"],
          ],
        },
        {
          type: "table",
          headers: ["Artikeltyp", "Beschreibung", "Beispiele"],
          rows: [
            ["consumable", "Wird verbraucht", "Schrauben, Kleber, Schleifpapier"],
            ["material", "Wird eingebaut/verkauft", "Holz, Platten, Kabel, Steckdosen"],
            ["tool", "Benutzt, nicht verbraucht", "Bohrmaschine, Leiter, Messgerät"],
            ["machine", "Maschinenkosten, Wartung", "Säge, Schleifmaschine"],
            ["rental / service_external", "Gemietet / Fremdleistung", "Mietgerät, Entsorgung, Sub"],
          ],
        },
        {
          type: "table",
          headers: ["Kennzahl", "Bedeutung"],
          rows: [
            ["on_hand_quantity", "Physisch vorhanden"],
            ["reserved_quantity", "Für Aufträge reserviert"],
            ["available_quantity", "Frei verfügbar"],
            ["ordered_quantity", "Bestellt, noch nicht geliefert"],
            ["minimum_stock / target_stock", "Mindest- und Zielbestand"],
            ["reorder_quantity / package_size", "Bestellmenge / Verpackungseinheit"],
          ],
        },
      ],
    },
    {
      id: "materialbedarf",
      number: "11",
      title: "Materialbedarf pro Auftrag",
      blocks: [
        {
          type: "list",
          ordered: true,
          items: [
            "Auftrag wird angelegt, Leistung ausgewählt",
            "App erzeugt Standard-Material- und Werkzeugvorschlag",
            "Büro/Meister bestätigt oder passt an",
            "App prüft Bestände je Lagerort",
            "Nach Freigabe: Reservierung",
            "Monteur erhält Packliste",
            "Monteur bestätigt Entnahme oder Fahrzeugbestand",
            "Beim Abschluss: Verbrauch buchen, Rückgabe umbuchen",
          ],
        },
        {
          type: "table",
          headers: ["Materialstatus", "Bedeutung", "Aktion"],
          rows: [
            ["not_checked", "Noch nicht geprüft", "Bedarf prüfen"],
            ["complete", "Vorhanden und reserviert", "Startklar"],
            ["partly_available", "Teilweise vorhanden", "Fehlteile bestellen"],
            ["missing", "Material fehlt", "Bestellvorschlag"],
            ["ordered / delivered / packed", "Bestellt / geliefert / gepackt", "Lieferung überwachen, Monteur informieren"],
            ["consumed", "Verbrauch gebucht", "Bestand aktualisiert"],
          ],
        },
        {
          type: "table",
          headers: ["Leistung", "Material", "Menge", "Reservierung?"],
          rows: [
            ["Tür montieren", "Zarge, Türblatt, Montageschaum, Schrauben", "1 / pauschal", "Ja (Material)"],
            ["Tür montieren", "Wasserwaage, Akkuschrauber", "1", "Nein – Verfügbarkeit prüfen"],
          ],
        },
      ],
    },
    {
      id: "lieferungen",
      number: "12",
      title: "Liefer- und Bestellprozesse",
      blocks: [
        {
          type: "table",
          headers: ["Strategie", "Logik", "Sinnvoll für"],
          rows: [
            ["manual", "Nur Warnung", "Sonderartikel"],
            ["min_stock_fixed_quantity", "Unter Mindestbestand → feste Menge", "Schrauben, Dübel"],
            ["min_stock_target_stock", "Bis Zielbestand auffüllen", "Standardartikel"],
            ["order_based", "Nur bei Auftragsbedarf", "Sondermaße, Türen"],
            ["combined", "Auftrag + Mindestbestand", "Kritische Standardartikel"],
            ["time_based_review", "Sammelbestellungen zu festen Tagen", "Regelmäßige Bestellungen"],
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Bestellvorschlagsformel",
          text: "Bestellmenge = aufrunden((Zielbestand − verfügbar + offener Auftragsbedarf) / Verpackungseinheit) × Verpackungseinheit. Ohne Verpackungseinheit: direkte Differenz. Mindestbestellmenge beim Lieferanten beachten.",
        },
        {
          type: "table",
          headers: ["Lieferstatus", "Bedeutung"],
          rows: [
            ["draft", "Bestellvorschlag, noch nicht bestellt"],
            ["ordered / confirmed", "Ausgelöst / Lieferant bestätigt"],
            ["partly_delivered / delivered", "Teilweise / vollständig geliefert"],
            ["delayed / cancelled / returned", "Verspätet / storniert / retourniert"],
          ],
        },
      ],
    },
    {
      id: "monteur",
      number: "13",
      title: "Monteur- und Baustellen-App",
      blocks: [
        {
          type: "paragraph",
          text: "Mobile Ansicht: klar, wenige Klicks – ohne Büro- und Kalkulationslogik. Was mache ich heute? Wo hin? Was mitnehmen? Was dokumentieren?",
        },
        {
          type: "cards",
          items: [
            { title: "Mein Tag", body: "Eigene Aufträge, Uhrzeiten, Route, Status, Materialampel" },
            { title: "Auftragsdetail", body: "Kunde, Adresse, Ansprechpartner, Beschreibung, Fotos, Checkliste, Phasen" },
            { title: "Packliste", body: "Material, Werkzeuge, Maschinen, Lagerort/Fahrzeug, gepackt ja/nein" },
            { title: "Zeit erfassen", body: "Start, Pause, Ende, Zusatzzeit, Grund" },
            { title: "Material verbuchen", body: "Verbraucht, nicht verbraucht, zusätzlich, zurückgegeben" },
            { title: "Dokumentation & Status", body: "Fotos, Notizen, Unterschrift, Mängel, Rückfrage an Büro" },
          ],
        },
      ],
    },
    {
      id: "plananalyse",
      number: "14",
      title: "Visuelles Plan-/Zeichnungstool",
      blocks: [
        {
          type: "paragraph",
          text: "Plananalyse ist fachlich wertvoll, aber kein Kern der V1. Sie baut auf Leistungsverzeichnis, Inventar und Artikelmapping auf.",
        },
        {
          type: "table",
          headers: ["Stufe", "Funktion", "Bewertung"],
          rows: [
            ["1. Plan hochladen", "PDF/Bild dem Auftrag zuordnen", "Früh möglich, hoher Nutzen"],
            ["2. Manuelle Markierung", "Schalter, Steckdosen, Türen, Räume markieren", "Sehr sinnvoll als erste Planfunktion"],
            ["3. Automatische Zählung", "Markierungen zählen → Bedarf", "Gut umsetzbar"],
            ["4. KI-Vorschläge", "Symbole erkennen, Mensch bestätigt", "Wertvoll, Validierung nötig"],
            ["5. CAD/BIM", "DWG/DXF/BIM auslesen", "Spätere Profi-Erweiterung"],
          ],
        },
        {
          type: "callout",
          variant: "warning",
          title: "Warum zuerst manuelle Markierung?",
          text: "Pläne unterscheiden sich stark (PDF, Scan, CAD, Skizze). Vollautomatische KI kann Mengen falsch erkennen. Bester Weg: Plan hochladen, markieren, Materialbedarf erzeugen – Mensch bestätigt immer.",
        },
      ],
    },
    {
      id: "datenmodell",
      number: "15",
      title: "Datenmodell – Kernentitäten",
      blocks: [
        {
          type: "table",
          headers: ["Entity", "Zweck", "Beziehungen"],
          rows: [
            ["Company", "Betriebseinstellungen", "Mitarbeiter, Lager, Leistungen, Artikel"],
            ["User/Employee", "Benutzer und Mitarbeiter", "Rollen, Qualifikationen, Aufträge"],
            ["Customer / Site", "Kunde und Einsatzort", "Objekte, Aufträge"],
            ["Order / OrderPhase / Task", "Auftrag mit Phasen und Aufgaben", "Material, Dokumente, Zeiten"],
            ["ServiceCatalogItem", "Leistung", "Material, Dauer, Checkliste"],
            ["Article / StorageLocation", "Inventar", "Bestände, Bewegungen, Reservierungen"],
            ["PurchaseOrder / Delivery", "Bestellung und Lieferung", "Wareneingang"],
            ["Document", "Fotos, PDFs, Pläne", "Auftrag, Kunde, Artikel"],
          ],
        },
      ],
    },
    {
      id: "api",
      number: "16",
      title: "API-Anforderungen",
      blocks: [
        {
          type: "table",
          headers: ["Modul", "Endpunkte (Auszug)"],
          rows: [
            ["Dashboard", "GET /api/dashboard/today, /critical, /upcoming"],
            ["Aufträge", "POST/GET/PUT /api/orders, POST …/assign, …/status"],
            ["Phasen", "POST/GET/PUT /api/orders/:id/phases, POST /api/phases/:id/complete"],
            ["Kunden", "POST/GET/PUT /api/customers, /api/sites"],
            ["Mitarbeiter", "POST/GET/PUT /api/employees, GET …/availability"],
            ["Rechte", "GET/PUT /api/roles, /api/permissions"],
            ["Leistungen", "POST/GET/PUT /api/services, …/material-template"],
            ["Inventar", "POST/GET/PUT /api/articles, GET /api/stock, POST …/movement"],
            ["Reservierungen", "POST /api/reservations, PUT …/release"],
            ["Bestellungen", "POST/GET/PUT /api/purchase-orders, POST …/receive"],
            ["Plananalyse", "POST /api/plans/upload, …/markers, GET …/material-summary"],
            ["Dokumente", "POST /api/documents/upload, GET …/generate"],
          ],
        },
      ],
    },
    {
      id: "ux",
      number: "17",
      title: "UI-/UX-Anforderungen",
      blocks: [
        {
          type: "table",
          headers: ["Prinzip", "Umsetzung"],
          rows: [
            ["Modern, aber einfach", "Karten, klare Typografie, große Buttons, wenig Rauschen"],
            ["Rollenabhängig", "Chef: Kennzahlen · Monteur: Tagesplan und Packliste"],
            ["Ampeln statt Zahlenwüsten", "Material, Status, Risiko, Lieferung farblich"],
            ["Mobile first (Monteur)", "Einhandbedienung, große Foto-/Statusbuttons"],
            ["Desktop stark (Büro)", "Tabellen, Filter, Kalender, Drag-and-drop"],
            ["Keine doppelte Pflege", "Leistung → Materialvorschlag → Packliste → Verbrauch"],
            ["Handwerkslogik", "mitnehmen, fehlt, bestellt, fertig, Nacharbeit – kein ERP-Jargon"],
          ],
        },
      ],
    },
    {
      id: "mvp",
      number: "18",
      title: "MVP-Abgrenzung",
      blocks: [
        {
          type: "checklist",
          items: [
            "Tagesdashboard mit kritischen Warnungen",
            "Kunden- und Objektverwaltung",
            "Mitarbeiter mit Rollen und Qualifikationen",
            "Aufträge mit Phasen, Status und Ergebnisstatus",
            "Leistungsverzeichnis Basis + Materialvorlage je Leistung",
            "Inventar mit Artikeln und Lagerorten",
            "Reservierung nach Freigabe, Packliste, Verbrauchsbuchung",
            "Einfache Bestellvorschläge bei Fehlmengen",
            "Lieferstatus für auftragsrelevantes Material",
          ],
        },
        {
          type: "callout",
          variant: "warning",
          title: "Bewusst später",
          text: "Vollautomatische KI-Planerkennung · CAD/BIM · Tourenoptimierung · Finanzbuchhaltung · EDI · vollautomatische Lagerbuchung ohne Bestätigung",
        },
      ],
    },
    {
      id: "entscheidung",
      number: "19",
      title: "Konkrete Umsetzungsentscheidung",
      blocks: [
        {
          type: "table",
          headers: ["Entscheidung", "Festlegung"],
          rows: [
            ["Erste Zielgruppe", "Baudienstleister: Wohnungssanierung, Innenausbau, Bau-DL"],
            ["Zweite Zielgruppe", "Elektrikerbetrieb, Fertigbauhaus, Privatkunden"],
            ["Inventarlogik", "Hybrid: einfache Bedienung, saubere Bewegungs- und Reservierungslogik"],
            ["Materialreservierung", "Vorschlag automatisch, Reservierung erst nach Freigabe"],
            ["Monteurpreise", "Standardmäßig verborgen"],
            ["Lagerorte", "Hauptlager, Fahrzeuge, Mitarbeiter, Baustelle, Reserviert, Defektlager"],
            ["Bestellung", "Artikelweise: manuell, Mindestbestand, Zielbestand, auftragsbasiert, kombiniert"],
            ["Phasen", "Mehrere Phasen möglich; kleiner Auftrag = eine Phase"],
            ["Plananalyse", "Vorbereiten, später manuelle Markierung, dann KI"],
          ],
        },
      ],
    },
    {
      id: "ki-bauauftrag",
      number: "20",
      title: "KI-Bauauftrag für spätere Umsetzung",
      blocks: [
        {
          type: "callout",
          variant: "decision",
          text: "Baue eine modulare Web- und Mobile-App für Handwerksbetriebe. V1 für Baudienstleister (Sanierung, Innenausbau). Architektur muss später Elektrikerbetrieb mit Stücklisten, Planmarkierungen und Prüfprozessen unterstützen. Implementiere Tagesdashboard, Kunden/Objekte, Mitarbeiter/Rollen/Rechte, Aufträge mit Phasen, Leistungsverzeichnis, Inventar, Materialbedarf, Reservierung, Verbrauch, Packlisten, Bestellvorschläge, Lieferstatus. Datenmodelle gewerkespezifisch erweiterbar. Interne Preise rollenbasiert geschützt. Monteure mobil nur mit Aufträgen, Packlisten, Checklisten, Zeiten, Fotos, Verbrauch, Status. Jeder Bestand über StockMovements nachvollziehbar; reserviert getrennt von verfügbar.",
        },
      ],
    },
    {
      id: "akzeptanz",
      number: "21",
      title: "Akzeptanzkriterien",
      blocks: [
        {
          type: "checklist",
          items: [
            "Chef sieht morgens alle kritischen Themen auf einen Blick",
            "Auftrag mit Kunde, Objekt, Leistung, Phase, Materialbedarf und Mitarbeiter anlegbar",
            "Kunde kann mehrere Objekte/Einsatzorte haben",
            "Mitarbeiter haben Rollen, Rechte und Qualifikationen",
            "Monteur sieht nur eigene Aufträge, keine sensiblen Kalkulationsdaten",
            "Leistung enthält Standardmaterial, Werkzeuge, Maschinen, Dauer, Checkliste",
            "Aus Leistung entsteht automatisch Materialvorschlag",
            "Material erst nach Freigabe reserviert",
            "Monteur bucht Verbrauch und Rückgabe beim Abschluss",
            "Inventar zeigt Bestand je Lagerort: reserviert, verfügbar, bestellt",
            "Bestellvorschläge: Mindestbestand, Zielbestand, Verpackung, Auftragsbedarf",
            "Auftrag: abgeschlossen, teilweise, nicht begonnen/nicht möglich",
            "Große Aufträge: mehrere Phasen mit eigenem Status und Materialliste",
            "Für Baudienstleister sofort nutzbar, für Elektriker erweiterbar",
          ],
        },
      ],
    },
  ],
};
