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
          Die Software wird mit branchenüblicher Sorgfalt bereitgestellt. Eine ununterbrochene
          Verfügbarkeit wird nicht zugesichert. Für Schäden, die auf höherer Gewalt, Störungen
          Dritter (Hosting, Netz, Zahlungs- oder Nachrichtenanbieter) oder unsachgemäßer Nutzung
          beruhen, wird nicht gehaftet, soweit gesetzlich zulässig. Zwingende Haftung (Vorsatz,
          grobe Fahrlässigkeit, Verletzung von Leben, Körper, Gesundheit, Produkthaftung) bleibt
          unberührt.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">5. Datenschutz</h2>
        <p>
          Ergänzend gilt die Datenschutzerklärung. Der Betrieb bleibt Verantwortlicher für die in
          seinem Mandanten verarbeiteten Kundendaten, soweit gesetzlich vorgesehen.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">6. Anwendbares Recht und Gerichtsstand</h2>
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
          Ist der Nutzer Kaufmann, juristische Person des öffentlichen Rechts oder hat er keinen
          allgemeinen Gerichtsstand in Deutschland, ist Gerichtsstand der Sitz des Anbieters.
        </p>
      </section>
    </LegalPageShell>
  );
}
