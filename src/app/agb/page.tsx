import { LegalPageShell } from "@/components/legal/legal-page-shell";

export default function AgbPage() {
  return (
    <LegalPageShell
      title="Allgemeine Geschäftsbedingungen (AGB)"
      subtitle="Vertragsentwurf für die Nutzung der JoMaster-Plattform durch Betriebe. Konditionen ergänzen und vor Verwendung anwaltlich prüfen lassen."
    >
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <h2 className="font-semibold">Entwurf für JoMaster – nicht für Endkunden des Betriebs</h2>
        <p>
          Diese Bedingungen regeln das Verhältnis zwischen JoMaster und dem nutzenden Betrieb.
          Ein Handwerksbetrieb benötigt für seine Kunden eigene Vertragsbedingungen nur, wenn er
          solche verwenden möchte. Stand: 25. September 2026.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">1. Anbieter, Kundenkreis und Geltung</h2>
        <p>
          Anbieter ist [vollständige Firma, Rechtsform und Anschrift]. Diese Bedingungen gelten für
          Verträge über die JoMaster-Software mit [Unternehmern / ggf. Verbrauchern – verbindlich
          festlegen]. Abweichende Bedingungen des Kunden gelten nur nach ausdrücklicher Zustimmung.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">2. Vertragsschluss und Testphase</h2>
        <p>
          [Registrierungs-, Angebots- und Annahmeprozess, Beginn einer Testphase, Umwandlung in einen
          zahlungspflichtigen Tarif und Korrekturmöglichkeiten verbindlich beschreiben.] Preise und
          Leistungsumfang des gewählten Tarifs werden vor Vertragsschluss angezeigt.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">3. Leistungsumfang</h2>
        <p>
          JoMaster stellt Funktionen zur Betriebsorganisation bereit, insbesondere Kunden- und
          Auftragsverwaltung, Disposition, Zeiterfassung, Dokumente und optionale KI-Funktionen.
          Maßgeblich sind Tarifbeschreibung, Leistungsbeschreibung und vereinbarte Service-Level.
          Fachliche, steuerliche oder rechtliche Beratung ist nicht geschuldet.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">4. Zugang, Rollen und Pflichten des Kunden</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Zugangsdaten und Geräte angemessen schützen</li>
          <li>nur berechtigte Personen einladen und Rollen regelmäßig prüfen</li>
          <li>Daten rechtmäßig erheben, Inhalte prüfen und Pflichtangaben pflegen</li>
          <li>keine schädlichen, rechtswidrigen oder fremde Rechte verletzenden Inhalte hochladen</li>
          <li>gesetzliche Aufbewahrungs-, Dokumentations- und Steuerpflichten selbst einhalten</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">5. Vergütung und Zahlungsverzug</h2>
        <p>
          [Preise, Umsatzsteuer, Abrechnungsintervall, Fälligkeit, Zahlungswege, zulässige
          Preisanpassungen, Folgen des Verzugs und Umgang mit Tarifwechseln eintragen.]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">6. Verfügbarkeit, Wartung und Support</h2>
        <p>
          [Verfügbarkeitsziel, Messmethode, ausgenommene Wartungsfenster, Supportzeiten und
          Reaktionsklassen konkret festlegen.] Sicherheitskritische Wartungen dürfen kurzfristig
          erfolgen. Eine durchgehend störungsfreie Nutzung kann technisch nicht garantiert werden.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">7. Kundendaten und Datenschutz</h2>
        <p>
          Kundendaten bleiben dem Kunden zugeordnet. Soweit JoMaster personenbezogene Daten im
          Auftrag verarbeitet, schließen die Parteien einen Vertrag nach Art. 28 DSGVO. Der Kunde
          bleibt für Rechtsgrundlagen, Information der Betroffenen, Weisungen und die Vergabe
          interner Zugriffsrechte verantwortlich.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">8. Drittanbieter und KI</h2>
        <p>
          Optionale Integrationen können eigenen Bedingungen unterliegen. KI-Ausgaben sind
          maschinell erzeugt, können unvollständig oder falsch sein und müssen vor geschäftlicher
          Verwendung geprüft werden. [Freigabe, Kosten und Datenflüsse konkreter Anbieter ergänzen.]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">9. Nutzungsrechte</h2>
        <p>
          Für die Vertragslaufzeit erhält der Kunde ein einfaches, nicht übertragbares Recht zur
          vertragsgemäßen Nutzung. Rechte an Software, Marken und Dokumentation verbleiben beim
          Anbieter. Notwendige Rechte an hochgeladenen Inhalten räumt der Kunde nur zum Betrieb der
          vereinbarten Leistung ein.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">10. Gewährleistung und Haftung</h2>
        <p>
          [Haftungsregelung passend zu Kundenkreis, Tarif und Versicherung juristisch formulieren.]
          Zwingende Haftung, insbesondere für Vorsatz, grobe Fahrlässigkeit, Verletzung von Leben,
          Körper oder Gesundheit sowie nach dem Produkthaftungsrecht, bleibt unberührt.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">11. Laufzeit, Kündigung und Datenexport</h2>
        <p>
          [Mindestlaufzeit, Verlängerung, ordentliche und außerordentliche Kündigung sowie
          Kündigungsweg festlegen.] Vor Vertragsende erhält der Kunde eine angemessene Möglichkeit
          zum Export seiner Daten. Frist, Format und anschließende Löschung einschließlich Backups
          sind verbindlich zu bestimmen.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">12. Änderungen der Bedingungen</h2>
        <p>
          Änderungen dürfen nur nach einem transparenten, rechtlich zulässigen Verfahren erfolgen.
          Anlass, Vorlauf, Mitteilung, Widerspruchs- beziehungsweise Kündigungsrecht und Folgen eines
          Widerspruchs sind vor Verwendung festzulegen.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">13. Schlussbestimmungen</h2>
        <p>
          [Anwendbares Recht und zulässigen Gerichtsstand je nach Kundenkreis festlegen.] Eine
          unwirksame Bestimmung lässt die Wirksamkeit der übrigen Regelungen nach den gesetzlichen
          Vorschriften unberührt. Vertragssprache ist [Deutsch].
        </p>
      </section>
    </LegalPageShell>
  );
}
