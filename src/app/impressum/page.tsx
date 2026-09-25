import { LegalPageShell } from "@/components/legal/legal-page-shell";

export default function ImpressumPage() {
  return (
    <LegalPageShell
      title="Impressum"
      subtitle="Anbieterkennzeichnung der JoMaster-Plattform. Offene Angaben müssen vor Veröffentlichung ergänzt und rechtlich geprüft werden."
    >
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <h2 className="font-semibold">Entwurf – noch nicht veröffentlichungsfertig</h2>
        <p>
          Eckige Klammern markieren Angaben, die der Betreiber von JoMaster verbindlich ergänzen
          muss. Dieses Impressum ist nicht das Impressum eines Handwerksbetriebs, der die Software
          nutzt. Stand: 25. September 2026.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Anbieter gemäß § 5 DDG</h2>
        <p>[Vollständiger Name / Firma und Rechtsform]</p>
        <p>[Straße und Hausnummer]</p>
        <p>[PLZ und Ort]</p>
        <p>Deutschland</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Vertretung und Kontakt</h2>
        <p>Vertretungsberechtigt: [Vor- und Nachname]</p>
        <p>Telefon: [Telefonnummer]</p>
        <p>E-Mail: [geschäftliche E-Mail-Adresse]</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Register und Kennnummern</h2>
        <p>Register: [z. B. Handelsregister – nur falls eingetragen]</p>
        <p>Registergericht und Registernummer: [Amtsgericht … / HRB …]</p>
        <p>Umsatzsteuer-Identifikationsnummer: [DE… – falls vorhanden]</p>
        <p>Wirtschafts-Identifikationsnummer: [falls vorhanden]</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Aufsicht und reglementierte Berufe</h2>
        <p>
          [Nur falls einschlägig: zuständige Aufsichtsbehörde, Kammer, gesetzliche
          Berufsbezeichnung, Staat der Verleihung und berufsrechtliche Regelungen mit Fundstelle.]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Redaktionell verantwortlich</h2>
        <p>
          [Nur bei journalistisch-redaktionellen Angeboten: Name und vollständige Anschrift der
          verantwortlichen Person gemäß § 18 Abs. 2 MStV.]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Verbraucherstreitbeilegung</h2>
        <p>
          [Erklärung, ob der Anbieter bereit oder verpflichtet ist, an einem
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen; bei
          Verpflichtung zusätzlich Anschrift und Website der zuständigen Stelle. Anwendbarkeit von
          § 36 VSBG prüfen.]
        </p>
      </section>
    </LegalPageShell>
  );
}
