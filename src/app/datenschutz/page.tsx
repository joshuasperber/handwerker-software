import { LegalPageShell } from "@/components/legal/legal-page-shell";

export default function DatenschutzPage() {
  return (
    <LegalPageShell
      title="Datenschutzerklärung"
      subtitle="Informationsentwurf für die JoMaster-Plattform nach Art. 13 und 14 DSGVO. Vor dem Produktivbetrieb vervollständigen und rechtlich prüfen lassen."
    >
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <h2 className="font-semibold">Entwurf – Verantwortlichkeiten zuerst klären</h2>
        <p>
          Dieser Text beschreibt JoMaster als Plattform. Bei Kundendaten eines Handwerksbetriebs ist
          regelmäßig der Betrieb Verantwortlicher und der Plattformanbieter Auftragsverarbeiter.
          Dafür werden zusätzlich ein Vertrag zur Auftragsverarbeitung und die eigenen
          Datenschutzhinweise des Betriebs benötigt. Stand: 25. September 2026.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">1. Verantwortlicher und Datenschutzkontakt</h2>
        <p>[Vollständige Firma / Name, Rechtsform, Anschrift, E-Mail, Telefon]</p>
        <p>[Datenschutzbeauftragte Person und Kontaktdaten – falls bestellt]</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">2. Aufruf von Website und App</h2>
        <p>
          Beim Aufruf können IP-Adresse, Zeitpunkt, aufgerufene Adresse, Referrer, Browser- und
          Geräteinformationen sowie technische Fehler- und Sicherheitsdaten verarbeitet werden.
          Zweck ist die sichere, stabile Auslieferung und Fehleranalyse. Rechtsgrundlage und
          konkrete Löschfrist sind anhand der eingesetzten Hosting- und Monitoringdienste
          einzutragen.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">3. Konto, Vertrag und Support</h2>
        <p>
          Für Registrierung, Anmeldung, Vertragsverwaltung, Abrechnung und Support werden
          Stamm-, Kontakt-, Vertrags-, Zahlungs- und Kommunikationsdaten verarbeitet. Anzugeben
          sind je Vorgang Zweck, Rechtsgrundlage, Pflicht zur Bereitstellung und Speicherdauer.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">4. Daten innerhalb eines Betriebsmandanten</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Kunden-, Interessenten-, Mitarbeiter- und Kontaktdaten</li>
          <li>Aufträge, Projekte, Termine, Einsatzorte und Leistungsangaben</li>
          <li>Rechnungs-, Zahlungs-, Kalkulations- und Buchhaltungsdaten</li>
          <li>Arbeitszeiten, Checklisten, Nachrichten, Fotos und Dateien</li>
          <li>Login-, Rollen-, Sicherheits- und Auditdaten</li>
        </ul>
        <p>
          Der Handwerksbetrieb legt Zwecke und zulässige Nutzung dieser Daten fest. JoMaster
          verarbeitet sie nach dokumentierter Weisung im Rahmen des Vertrags zur
          Auftragsverarbeitung, soweit keine eigene Verantwortlichkeit besteht.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">5. Öffentliche Buchungsanfragen</h2>
        <p>
          Bei einer Anfrage können Leistung, Beschreibung, Adresse, Terminwunsch, Kontaktdaten und
          hochgeladene Bilder erfasst werden. Verantwortlicher ist der jeweils bezeichnete
          Handwerksbetrieb. Die Verarbeitung kann insbesondere zur Durchführung vorvertraglicher
          Maßnahmen erforderlich sein; eine bloße Kenntnisnahme der Datenschutzhinweise ist keine
          Einwilligung in eine ansonsten unzulässige Verarbeitung.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">6. KI-Funktionen</h2>
        <p>
          Bei aktivierter KI können Eingaben und die für die Antwort erforderlichen Betriebsdaten
          an den konkret benannten KI-Dienst übermittelt werden. Vor Veröffentlichung sind Anbieter,
          Zweck, Rechtsgrundlage, Datenkategorien, Speicher- beziehungsweise Trainingsnutzung und
          mögliche Drittlandübermittlungen exakt zu dokumentieren. KI-Ausgaben können fehlerhaft
          sein und ersetzen keine Rechts- oder Steuerberatung.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">7. Empfänger und Dienstleister</h2>
        <p>
          [Tatsächliche Anbieter für Hosting, Datenbank, Dateispeicher, E-Mail, SMS, Monitoring,
          Support, Zahlung und KI jeweils mit Sitz und Aufgabe aufführen.] Auftragsverarbeiter sind
          vertraglich nach Art. 28 DSGVO zu binden.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">8. Übermittlungen in Drittländer</h2>
        <p>
          [Für jeden Dienst außerhalb EU/EWR: Empfängerland, Angemessenheitsbeschluss oder andere
          Garantie, etwa Standardvertragsklauseln, und Möglichkeit zum Erhalt einer Kopie nennen.]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">9. Cookies und lokaler Speicher</h2>
        <p>
          Technisch erforderliche Sitzungs- und Sicherheitsspeicher dürfen nur im notwendigen Umfang
          eingesetzt werden. Nicht erforderliche Analyse- oder Marketingtechnologien benötigen vor
          dem Zugriff grundsätzlich eine wirksame Einwilligung. Die tatsächlich verwendeten Namen,
          Zwecke und Laufzeiten sind zu ergänzen.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">10. Speicherdauer</h2>
        <p>
          Für jede Verarbeitung ist eine konkrete Frist oder ein nachvollziehbares Kriterium zu
          nennen. Vertrags- und Rechnungsdaten können gesetzlichen Aufbewahrungspflichten
          unterliegen; Sicherheitsprotokolle, Supportdaten, Dateien und gelöschte Konten benötigen
          eigene Löschregeln einschließlich Backups.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">11. Rechte betroffener Personen</h2>
        <p>
          Betroffene können – je nach Voraussetzungen – Auskunft, Berichtigung, Löschung,
          Einschränkung, Datenübertragbarkeit und Widerspruch verlangen sowie Einwilligungen mit
          Wirkung für die Zukunft widerrufen. Außerdem besteht ein Beschwerderecht bei einer
          Datenschutzaufsichtsbehörde. [Zuständige Aufsicht und Kontaktweg ergänzen.]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">12. Automatisierte Entscheidungen und Sicherheit</h2>
        <p>
          [Angeben, ob Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung ausschließlich
          automatisiert erfolgen.] Technische und organisatorische Maßnahmen umfassen unter anderem
          Rollen, Mandantentrennung, Transportverschlüsselung, Protokollierung und Wiederherstellung;
          die tatsächlichen Maßnahmen sind im Sicherheitskonzept und AV-Vertrag zu konkretisieren.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">13. Änderungen</h2>
        <p>
          Diese Erklärung ist bei Änderungen von Funktionen, Dienstleistern oder Rechtslage zu
          aktualisieren. Wesentliche Änderungen sollten registrierten Kunden nachvollziehbar
          mitgeteilt werden.
        </p>
      </section>
    </LegalPageShell>
  );
}
