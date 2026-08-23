export const SETTINGS_PAGE_INTROS: Record<
  string,
  { title: string; description: string }
> = {
  "/dashboard/einstellungen/betrieb": {
    title: "Betrieb",
    description:
      "Hier verwalten Sie die Stammdaten Ihres Betriebs, zum Beispiel Name, Adresse, Logo, Kontaktdaten und den öffentlichen Buchungslink.",
  },
  "/dashboard/einstellungen/rechnung": {
    title: "Rechnungseinstellungen",
    description:
      "Hier passen Sie Rechnungen an, zum Beispiel Logo, Farben, Zahlungsbedingungen, Standardtexte und PDF-Layout.",
  },
  "/dashboard/einstellungen/benachrichtigungen": {
    title: "Benachrichtigungen",
    description:
      "Hier konfigurieren Sie Erinnerungen, E-Mail- und Nachrichtenversand sowie automatische Terminbenachrichtigungen.",
  },
  "/dashboard/einstellungen/rollen": {
    title: "Rollen & Rechte",
    description:
      "Hier verwalten Sie, welche Nutzer welche Bereiche sehen und bearbeiten dürfen.",
  },
  "/dashboard/einstellungen/sicherheit": {
    title: "Sicherheit & Datenschutz",
    description:
      "Hier finden Sie Einstellungen und Informationen zu Datenschutz, Zugriffsschutz, Impressum, AGB und rechtlichen Pflichtangaben.",
  },
  "/dashboard/einstellungen/system": {
    title: "Systemstatus",
    description:
      "Hier sehen Sie technische Informationen, Schnittstellenstatus, Fehler und Verfügbarkeit wichtiger Dienste.",
  },
  "/dashboard/einstellungen/assistent": {
    title: "Betriebsassistent-Einstellungen",
    description:
      "Hier konfigurieren Sie den KI-Assistenten und legen fest, auf welche Daten er zugreifen darf.",
  },
};

export const SETTINGS_NAV_ORDER = [
  "/dashboard/einstellungen/betrieb",
  "/dashboard/einstellungen/rechnung",
  "/dashboard/einstellungen/benachrichtigungen",
  "/dashboard/einstellungen/rollen",
  "/dashboard/einstellungen/sicherheit",
  "/dashboard/einstellungen/system",
  "/dashboard/einstellungen/assistent",
] as const;
