import { LegalPageShell } from "@/components/legal/legal-page-shell";

export default function DatenschutzPage() {
  return (
    <LegalPageShell
      title="Datenschutzerklärung"
      subtitle="Technischer Platzhalter zur Vorbereitung der Informationspflichten nach Art. 13/14 DSGVO. Keine Rechtsberatung — vor Go-Live von Fachperson prüfen lassen."
    >
      <section>
        <h2 className="text-lg font-semibold text-slate-900">1. Verantwortlicher</h2>
        <p>[Firmenname], [Adresse], [E-Mail], [Telefon]</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">2. Zwecke der Verarbeitung</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Bereitstellung der Handwerkssoftware (Kunden, Aufträge, Termine, Rechnungen)</li>
          <li>Authentifizierung und Rechteverwaltung</li>
          <li>Dokumentation von Baustellen (Fotos, Belege, Stundenzettel)</li>
          <li>optional: KI-Assistent zur Auswertung eigener Betriebsdaten</li>
          <li>Sicherheit (Login-Protokolle, Audit-Logs)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">3. Kategorien personenbezogener Daten</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Stammdaten von Kunden und Mitarbeitenden (Name, E-Mail, Telefon, Adresse)</li>
          <li>Auftrags-, Termin- und Projektdaten</li>
          <li>Rechnungs- und Zahlungsdaten</li>
          <li>Arbeitszeiten / Stundenzettel</li>
          <li>Fotos und Dateien zu Aufträgen/Projekten</li>
          <li>KI-Chatverläufe und zugehörige Audit-Einträge</li>
          <li>Technische Protokolldaten (IP bei Loginversuchen)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">4. Rechtsgrundlagen (Platzhalter)</h2>
        <p>
          Typischerweise Art. 6 Abs. 1 lit. b DSGVO (Vertrag), lit. c (rechtliche Pflichten, z. B.
          Aufbewahrung), lit. f (berechtigte Interessen, z. B. IT-Sicherheit) sowie ggf. Einwilligung
          (Art. 6 Abs. 1 lit. a) — konkret durch Rechtsberatung festzulegen.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">5. Speicherdauer</h2>
        <p>
          Loginversuche werden technisch nach ca. 7 Tagen gelöscht. KI-Chats werden pro Nutzer auf
          eine kleine Anzahl begrenzt und sind löschbar. Für Rechnungen, Belege und Buchungsdaten
          gelten voraussichtlich gesetzliche Aufbewahrungsfristen — bitte fachlich festlegen.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">6. Empfänger / Auftragsverarbeiter</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Hosting / Datenbank (z. B. Vercel, PostgreSQL/Supabase)</li>
          <li>Objekt-Speicher für Dateien (S3-kompatibel)</li>
          <li>optional KI-Anbieter (Groq / OpenAI), sofern konfiguriert</li>
          <li>optional E-Mail-/SMS-Dienste für Benachrichtigungen</li>
        </ul>
        <p>AV-Verträge und Drittlandtransfers müssen juristisch geprüft werden.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">7. Cookies</h2>
        <p>
          Es werden technisch notwendige Session-Cookies (`jomaster-session`) für die Anmeldung
          gesetzt. Marketing-Tracking-Cookies sind in dieser App derzeit nicht vorgesehen.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">8. Betroffenenrechte</h2>
        <p>
          Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit und
          Beschwerde bei einer Aufsichtsbehörde. Technisch vorbereitet: Admin-Bereich Sicherheit mit
          Export-/Lösch-Check sowie Chat-Löschung im Betriebsassistenten.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">9. KI-Funktionen</h2>
        <p>
          Bei Nutzung des Betriebsassistenten können Anfragetext und ausgewählte Betriebsdaten an
          den konfigurierten KI-Anbieter übermittelt werden. Antworten können Fehler enthalten und
          ersetzen keine Steuer- oder Rechtsberatung.
        </p>
      </section>
    </LegalPageShell>
  );
}
