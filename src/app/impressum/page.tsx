import { LegalPageShell } from "@/components/legal/legal-page-shell";

export default function ImpressumPage() {
  return (
    <LegalPageShell
      title="Impressum"
      subtitle="Technischer Platzhalter gemäß § 5 TMG / § 18 MStV — Inhalte müssen vor Produktivbetrieb rechtlich geprüft und vervollständigt werden."
    >
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Angaben zum Anbieter</h2>
        <p>[Firmenname / Betreiber der JoMaster-Instanz]</p>
        <p>[Straße Hausnummer]</p>
        <p>[PLZ Ort]</p>
        <p>Deutschland</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Kontakt</h2>
        <p>E-Mail: [kontakt@beispiel.de]</p>
        <p>Telefon: [Telefonnummer]</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Vertretungsberechtigt</h2>
        <p>[Name der vertretungsberechtigten Person]</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Registereintrag</h2>
        <p>Registergericht: [Amtsgericht …]</p>
        <p>Registernummer: [HRB …]</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Umsatzsteuer-ID</h2>
        <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: [DE…]</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Verantwortlich für den Inhalt</h2>
        <p>[Name], Anschrift wie oben</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Hinweis für Mandanten-Betriebe</h2>
        <p>
          Für öffentliche Buchungsseiten einzelner Handwerksbetriebe können zusätzlich die im
          Betriebsprofil hinterlegten Impressums- und Datenschutz-URLs gelten. Diese App-Seite
          ersetzt keine betriebsindividuellen Pflichtangaben.
        </p>
      </section>
    </LegalPageShell>
  );
}
