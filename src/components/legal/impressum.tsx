import Link from "next/link";
import {
  LegalPage,
  LegalSection,
  type TocItem,
} from "@/components/legal/legal-page";
import {
  EmailValue,
  Fact,
  FactList,
  MissingValue,
  ProviderAddress,
} from "@/components/legal/provider-block";
import { legalUi } from "@/i18n/legal";
import { getMessages, getSite } from "@/i18n/server";
import { getLegal } from "@/lib/legal";

const toc: TocItem[] = [
  { id: "anbieter", title: "Angaben zum Anbieter" },
  { id: "kontakt", title: "Kontakt" },
  { id: "register", title: "Handelsregister und Mehrwertsteuer" },
  { id: "haftung-inhalte", title: "Haftungsausschluss" },
  { id: "haftung-links", title: "Haftung für Links" },
  { id: "urheberrecht", title: "Urheberrecht" },
  { id: "datenschutz", title: "Datenschutz" },
];

/** Impressum des Vereins: Anbieterdaten aus den Admin-Einstellungen, Vorstand aus den Stammdaten der Seite. */
export async function Impressum() {
  const legal = await getLegal();
  const site = await getSite();
  const ui = await getMessages(legalUi);

  return (
    <LegalPage
      eyebrow={ui.eyebrow}
      title={ui.imprint.title}
      description={`Angaben zum Verein hinter ${site.name} und Möglichkeiten, uns zu erreichen.`}
      toc={toc}
    >
      <LegalSection id="anbieter" number={1} title="Angaben zum Anbieter">
        <p>Anbieter dieser Website ist der Verein:</p>
        <ProviderAddress legal={legal} name={site.legalName} />
        <FactList>
          <Fact label="Rechtsform">
            Verein im Sinne von Art. 60 ff. ZGB, nicht gewinnorientiert
          </Fact>
          <Fact label="Vertreten durch">
            Vorstand:
            <ul className="!mt-1 list-none space-y-0.5 !pl-0">
              {site.board.map((member) => (
                <li key={member.name}>
                  {member.name}, {member.role}
                </li>
              ))}
            </ul>
          </Fact>
          <Fact label="Ansprechperson">{legal.responsible}</Fact>
          <Fact label="Website">{site.domain}</Fact>
        </FactList>
      </LegalSection>

      <LegalSection id="kontakt" number={2} title="Kontakt">
        <FactList>
          <Fact label="E-Mail">
            <EmailValue email={legal.email} />
          </Fact>
          {legal.phone && <Fact label="Telefon">{legal.phone}</Fact>}
          <Fact label="Kontaktformular">
            <Link href="/contact">Zum Kontaktformular</Link>
          </Fact>
        </FactList>
        <p>
          Für eine schnelle elektronische Kontaktaufnahme stehen dir die
          E-Mail-Adresse und das Kontaktformular zur Verfügung. Anfragen über
          das Formular werden als Ticket erfasst und bearbeitet.
        </p>
      </LegalSection>

      <LegalSection
        id="register"
        number={3}
        title="Handelsregister und Mehrwertsteuer"
      >
        {/* Häkchen im Dashboard (Einstellungen → Rechtliches) haben Vorrang: dann ist keine Angabe nötig. */}
        {(!legal.hideRegister && !legal.noRegister && legal.register) ||
        (!legal.hideVat && !legal.smallBusiness && legal.vatId) ? (
          <FactList>
            {!legal.hideRegister && !legal.noRegister && legal.register && (
              <Fact label="Handelsregister / UID">{legal.register}</Fact>
            )}
            {!legal.hideVat && !legal.smallBusiness && legal.vatId && (
              <Fact label="MWST-Nummer">{legal.vatId}</Fact>
            )}
          </FactList>
        ) : null}
        {!legal.hideRegister && legal.noRegister && (
          <p>Der Verein ist nicht im Handelsregister eingetragen.</p>
        )}
        {!legal.hideVat && legal.smallBusiness && (
          <p>
            Der Verein ist nicht mehrwertsteuerpflichtig; es wird keine
            Mehrwertsteuer ausgewiesen und keine MWST-Nummer angegeben.
          </p>
        )}
        {!legal.hideRegister && !legal.noRegister && !legal.register && (
          <p>
            Handelsregister / UID: <MissingValue />
          </p>
        )}
        {!legal.hideVat && !legal.smallBusiness && !legal.vatId && (
          <p>
            MWST-Nummer: <MissingValue />
          </p>
        )}
        {legal.hideRegister && legal.hideVat && (
          <p>
            Zu Handelsregister und Mehrwertsteuer sind hier keine Angaben
            erforderlich.
          </p>
        )}
      </LegalSection>

      <LegalSection id="haftung-inhalte" number={4} title="Haftungsausschluss">
        <p>
          Wir erstellen die Inhalte dieser Website mit grösster Sorgfalt. Wir
          übernehmen jedoch keine Gewähr für die Richtigkeit, Vollständigkeit,
          Aktualität und Verfügbarkeit der Inhalte und Dienste. Haftungsansprüche
          wegen Schäden, die aus der Nutzung oder Nichtnutzung der angebotenen
          Informationen oder aus Störungen und Ausfällen entstehen, sind
          ausgeschlossen, soweit das Gesetz dies zulässt.
        </p>
        <p>
          Wir behalten uns vor, Inhalte und Angebote ohne gesonderte
          Ankündigung zu ändern, zu ergänzen oder zu entfernen.
        </p>
      </LegalSection>

      <LegalSection id="haftung-links" number={5} title="Haftung für Links">
        <p>
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren
          Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte
          übernehmen wir keine Gewähr; verantwortlich ist stets der jeweilige
          Anbieter oder Betreiber der verlinkten Seite.
        </p>
        <p>
          Auf Inhalte verlinkter Seiten haben wir keinen Einfluss. Sobald wir
          von Rechtsverletzungen erfahren, entfernen wir den betreffenden
          Link.
        </p>
      </LegalSection>

      <LegalSection id="urheberrecht" number={6} title="Urheberrecht">
        <p>
          Die von uns erstellten Inhalte und Werke auf dieser Website
          unterliegen dem Urheberrecht. Die Software hinter unseren Diensten
          wird, soweit nicht anders gekennzeichnet, unter den Lizenzen der
          jeweiligen Open-Source-Projekte bereitgestellt; es gelten die dort
          genannten Lizenzbedingungen.
        </p>
        <p>
          Beiträge Dritter sind als solche gekennzeichnet. Wenn du auf eine
          Urheberrechtsverletzung aufmerksam wirst, bitten wir um einen
          Hinweis über das <Link href="/contact">Kontaktformular</Link>. Wir
          entfernen betroffene Inhalte, sobald wir von der Verletzung
          erfahren.
        </p>
      </LegalSection>

      <LegalSection id="datenschutz" number={7} title="Datenschutz">
        <p>
          Wie wir mit Personendaten umgehen, steht in der{" "}
          <Link href="/datenschutz">Datenschutzerklärung</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
