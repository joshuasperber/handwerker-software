import { LegalPageShell } from "@/components/legal/legal-page-shell";

export default function ImpressumPage() {
  return (
    <LegalPageShell
      title="Impressum"
      subtitle="Technischer Platzhalter gemäß § 5 TMG / § 18 MStV — Inhalte müssen vor Produktivbetrieb rechtlich geprüft und vervollständigt werden."
    >
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Angaben zum Anbieter</h2>
        <p>[JoMaster / Joshua Sperber]</p>
        <p>[Pufendorfstraße 6a]</p>
        <p>[10249 Berlin]</p>
        <p>Deutschland</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Kontakt</h2>
        <p>E-Mail: [joshua.sperber@web.de]</p>
        <p>Telefon: [+49 15259655035]</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Vertretungsberechtigt</h2>
        <p>[Joshua Sperber]</p>
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

    </LegalPageShell>
  );
}
