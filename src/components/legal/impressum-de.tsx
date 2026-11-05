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
import { site as siteData } from "@/lib/site";
import { SITES } from "@/lib/sites";

// Schweizer Partnerverein (Stammdaten)
const partner = siteData.partner;

const toc: TocItem[] = [
  { id: "anbieter", title: "Angaben gemäß § 5 DDG" },
  { id: "kontakt", title: "Kontakt" },
  { id: "register", title: "Register und Steuer" },
  { id: "verantwortlich", title: "Verantwortlich für Inhalte" },
  { id: "streitbeilegung", title: "Verbraucherstreitbeilegung" },
  { id: "haftung-inhalte", title: "Haftung für Inhalte" },
  { id: "haftung-links", title: "Haftung für Links" },
  { id: "urheberrecht", title: "Urheberrecht" },
  { id: "partnerverein", title: "Partnerverein in der Schweiz" },
];

/** Deutsche Fassung (vylaris.eu und vylaris.de): Anbieterdaten aus den Admin-Einstellungen; auf vylaris.de mit anderem Ansprechpartner. */
export async function ImpressumDe() {
  const legal = await getLegal();
  const site = await getSite();
  const ui = await getMessages(legalUi);
  // Marke der aufgerufenen Seite und Betreiber (Anbieter) – auf vylaris.eu identisch.
  const brand = site.name;
  const provider = SITES.eu;
  const isDe = site.key === "de";

  return (
    <LegalPage
      eyebrow={ui.eyebrow}
      title={ui.imprint.title}
      description={`Anbieterkennzeichnung für die Website von ${brand}.`}
      toc={toc}
    >
      <LegalSection id="anbieter" number={1} title="Angaben gemäß § 5 DDG">
        <p>Anbieter dieser Website ist:</p>
        <ProviderAddress legal={legal} name={provider.name} />
        <FactList>
          {isDe ? (
            <>
              <Fact label="Vertreten durch">
                {site.leader.name}, Leitung {site.name}
              </Fact>
              <Fact label="Unternehmen / Marke">
                {provider.name}, Leitung {legal.responsible}
              </Fact>
            </>
          ) : (
            <>
              <Fact label="Vertreten durch">
                {legal.responsible}, Leitung {provider.name}
              </Fact>
              <Fact label="Unternehmen / Marke">{provider.leader.company}</Fact>
            </>
          )}
        </FactList>
        {isDe ? (
          <>
            <p>
              Die Website von {brand} ({site.domain}) wird technisch und
              organisatorisch zentral über {provider.name} (
              <a
                href={`https://${provider.domain}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {provider.domain}
              </a>
              ) betrieben, gehostet und verwaltet. Die Anbieterangaben
              entsprechen daher denen von {provider.name}; für {brand} vertretungsberechtigt ist {site.leader.name}.
            </p>
            <p>Zum Schweizer Partnerverein {partner.name} siehe Abschnitt 9.</p>
          </>
        ) : (
          <p>
            {brand} ist die offizielle europäische Zweitstelle der VylarisGroup
            und arbeitet Hand in Hand mit dem Schweizer Partnerverein{" "}
            {partner.name} (siehe Abschnitt 9).
          </p>
        )}
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

      <LegalSection id="register" number={3} title="Register und Steuer">
        {/* Häkchen im Dashboard (Einstellungen → Rechtliches) haben Vorrang: dann ist keine Angabe nötig. */}
        {(!legal.hideRegister && !legal.noRegister && legal.register) ||
        (!legal.hideVat && !legal.smallBusiness && legal.vatId) ? (
          <FactList>
            {!legal.hideRegister && !legal.noRegister && legal.register && (
              <Fact label="Registereintrag">{legal.register}</Fact>
            )}
            {!legal.hideVat && !legal.smallBusiness && legal.vatId && (
              <Fact label="Umsatzsteuer-ID">{legal.vatId}</Fact>
            )}
          </FactList>
        ) : null}
        {!legal.hideRegister && legal.noRegister && (
          <p>
            Es besteht kein Eintrag im Handelsregister oder in einem
            vergleichbaren Register.
          </p>
        )}
        {!legal.hideVat && legal.smallBusiness && (
          <p>
            Kleinunternehmer im Sinne von § 19 UStG: Es wird keine Umsatzsteuer
            ausgewiesen. Eine Umsatzsteuer-Identifikationsnummer wird nicht
            angegeben.
          </p>
        )}
        {!legal.hideRegister && !legal.noRegister && !legal.register && (
          <p>
            Registereintrag: <MissingValue />
          </p>
        )}
        {!legal.hideVat && !legal.smallBusiness && !legal.vatId && (
          <p>
            Umsatzsteuer-Identifikationsnummer: <MissingValue />
          </p>
        )}
        {legal.hideRegister && legal.hideVat && (
          <p>Zu Register und Umsatzsteuer sind hier keine Angaben erforderlich.</p>
        )}
      </LegalSection>

      <LegalSection
        id="verantwortlich"
        number={4}
        title="Verantwortlich für Inhalte nach § 18 Abs. 2 MStV"
      >
        <p>
          {isDe ? site.leader.name : legal.responsible}
          <br />
          Anschrift wie unter Abschnitt 1
        </p>
      </LegalSection>

      <LegalSection
        id="streitbeilegung"
        number={5}
        title="Verbraucherstreitbeilegung"
      >
        <p>
          Die frühere Plattform der Europäischen Kommission zur
          Online-Streitbeilegung (OS-Plattform) wurde im Juli 2025 eingestellt.
          Auf sie wird daher nicht mehr verwiesen.
        </p>
        <p>
          Wir sind weder bereit noch verpflichtet, an Streitbeilegungsverfahren
          vor einer Verbraucherschlichtungsstelle im Sinne des
          Verbraucherstreitbeilegungsgesetzes (VSBG) teilzunehmen.
        </p>
      </LegalSection>

      <LegalSection id="haftung-inhalte" number={6} title="Haftung für Inhalte">
        <p>
          Als Diensteanbieter sind wir nach den allgemeinen Gesetzen für eigene
          Inhalte auf diesen Seiten verantwortlich. Wir sind jedoch nicht
          verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
          überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
          Tätigkeit hinweisen.
        </p>
        <p>
          Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
          Informationen nach den allgemeinen Gesetzen bleiben unberührt. Eine
          diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis
          einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden
          entsprechender Rechtsverletzungen entfernen wir diese Inhalte
          umgehend.
        </p>
      </LegalSection>

      <LegalSection id="haftung-links" number={7} title="Haftung für Links">
        <p>
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren
          Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte können
          wir keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist
          stets der jeweilige Anbieter oder Betreiber verantwortlich.
        </p>
        <p>
          Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
          Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zu diesem
          Zeitpunkt nicht erkennbar. Eine permanente inhaltliche Kontrolle der
          verlinkten Seiten ist ohne konkrete Anhaltspunkte einer
          Rechtsverletzung jedoch nicht zumutbar. Bei Bekanntwerden von
          Rechtsverletzungen entfernen wir derartige Links umgehend.
        </p>
      </LegalSection>

      <LegalSection id="urheberrecht" number={8} title="Urheberrecht">
        <p>
          Die durch uns erstellten Inhalte und Werke auf diesen Seiten
          unterliegen dem Urheberrecht. Die Software hinter unseren Diensten
          wird, soweit nicht anders gekennzeichnet, unter den Lizenzen der
          jeweiligen Open-Source-Projekte bereitgestellt; es gelten die dort
          genannten Lizenzbedingungen.
        </p>
        <p>
          Beiträge Dritter sind als solche gekennzeichnet. Solltest du auf eine
          Urheberrechtsverletzung aufmerksam werden, bitten wir um einen
          entsprechenden Hinweis über das{" "}
          <Link href="/contact">Kontaktformular</Link>. Bei Bekanntwerden von
          Rechtsverletzungen entfernen wir die betroffenen Inhalte umgehend.
        </p>
      </LegalSection>

      <LegalSection
        id="partnerverein"
        number={9}
        title="Partnerverein in der Schweiz"
      >
        <p>
          {partner.name} (
          <a href={partner.url} target="_blank" rel="noopener noreferrer">
            {partner.domain}
          </a>
          ) ist ein rechtlich eigenständiger Schweizer Verein. Er ist das
          ideelle Ursprungsprojekt, mit dem wir Hand in Hand zusammenarbeiten,
          aber nicht Teil von {provider.name}.
        </p>
        <p>
          Dieses Impressum gilt ausschließlich für die Website von {brand}. Für
          die Inhalte, Angebote und Angaben des Vereins {partner.name} gilt es
          nicht; maßgeblich sind dort die Angaben des Vereins selbst.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
