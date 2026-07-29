import { LegalPageShell } from "@/components/legal/legal-page-shell";

export default function AgbPage() {
  return (
    <LegalPageShell
      title="Allgemeine Geschäftsbedingungen (AGB)"
      subtitle="Optionaler Platzhalter für Nutzungsbedingungen der Plattform. Vor Veröffentlichung rechtlich prüfen lassen."
    >
      <section>
        <h2 className="text-lg font-semibold text-slate-900">1. Geltungsbereich</h2>
        <p>
          Diese Bedingungen gelten für die Nutzung der JoMaster-Software durch registrierte
          Handwerksbetriebe und deren autorisierte Nutzer.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">2. Leistungen</h2>
        <p>
          JoMaster stellt digitale Werkzeuge zur Betriebsorganisation bereit (u. a. Aufträge,
          Disposition, Zeiterfassung, Rechnungen, optional KI-Assistent). Funktionsumfang kann sich
          weiterentwickeln.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">3. Pflichten des Kunden</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Zugangsdaten geheim halten</li>
          <li>nur berechtigte Personen freischalten</li>
          <li>keine rechtswidrigen Inhalte hochladen</li>
          <li>gesetzliche Aufbewahrungspflichten selbst einhalten</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">4. Verfügbarkeit & Haftung</h2>
        <p>
          [Platzhalter für SLA, Haftungsbeschränkungen, höhere Gewalt — juristisch auszuformulieren]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">5. Datenschutz</h2>
        <p>
          Ergänzend gilt die Datenschutzerklärung unter /datenschutz. Der Kunde bleibt
          Verantwortlicher für die in seinem Mandanten verarbeiteten Kundendaten, soweit gesetzlich
          vorgesehen.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">6. Schlussbestimmungen</h2>
        <p>Gerichtsstand / anwendbares Recht: [Platzhalter].</p>
      </section>
    </LegalPageShell>
  );
}
