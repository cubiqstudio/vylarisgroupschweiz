import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { EmailValue, Fact, FactList, ProviderAddress } from "@/components/legal/provider-block";
import { legalUi } from "@/i18n/legal";
import { getMessages, getSite } from "@/i18n/server";
import { getLegal } from "@/lib/legal";
import { imprintSections } from "@/lib/legal-toggles";

/**
 * Impressum des Vereins: Anbieterdaten aus den Admin-Einstellungen, Vorstand aus den Stammdaten der Seite.
 * Es erscheint nur, was in «Einstellungen → Rechtliches» eingeschaltet ist und einen Inhalt hat; Inhaltsverzeichnis
 * und Nummerierung folgen den sichtbaren Abschnitten.
 */
export async function Impressum() {
  const legal = await getLegal();
  const site = await getSite();
  const ui = await getMessages(legalUi);

  const v = legal.imprint;
  const sections = imprintSections(v);
  const titleOf = (id: string) => sections.find((s) => s.id === id)?.title ?? "";
  const numberOf = (id: string) => sections.find((s) => s.id === id)?.number ?? 0;
  const has = (id: string) => sections.some((s) => s.id === id);

  const board = site.board;
  const showBoard = v.board && board.length > 0;
  const showRegisterFact = v.register && !legal.noRegister && Boolean(legal.register);
  const showVatFact = v.vat && !legal.smallBusiness && Boolean(legal.vatId);
  const channels = [v.email && "die E-Mail-Adresse", v.contactForm && "das Kontaktformular"].filter(Boolean);

  return (
    <LegalPage
      eyebrow={ui.eyebrow}
      title={ui.imprint.title}
      description={`Angaben zum Verein hinter ${site.name} und Möglichkeiten, uns zu erreichen.`}
      toc={sections.map(({ id, title }) => ({ id, title }))}
    >
      {sections.length === 0 && <p>{ui.imprint.empty}</p>}

      {has("anbieter") && (
        <LegalSection id="anbieter" number={numberOf("anbieter")} title={titleOf("anbieter")}>
          {(v.name || v.address) && <p>Anbieter dieser Website ist der Verein:</p>}
          <ProviderAddress legal={legal} name={site.legalName} showName={v.name} showAddress={v.address} />
          {(v.legalForm || showBoard || v.responsible || v.website) && (
            <FactList>
              {v.legalForm && <Fact label="Rechtsform">Verein im Sinne von Art. 60 ff. ZGB, nicht gewinnorientiert</Fact>}
              {showBoard && (
                <Fact label="Vertreten durch">
                  Vorstand:
                  <ul className="!mt-1 list-none space-y-0.5 !pl-0">
                    {board.map((member) => (
                      <li key={member.name}>
                        {member.name}, {member.role}
                      </li>
                    ))}
                  </ul>
                </Fact>
              )}
              {v.responsible && <Fact label="Ansprechperson">{legal.responsible}</Fact>}
              {v.website && <Fact label="Website">{site.domain}</Fact>}
            </FactList>
          )}
        </LegalSection>
      )}

      {has("kontakt") && (
        <LegalSection id="kontakt" number={numberOf("kontakt")} title={titleOf("kontakt")}>
          <FactList>
            {v.email && (
              <Fact label="E-Mail">
                <EmailValue email={legal.email} />
              </Fact>
            )}
            {v.phone && <Fact label="Telefon">{legal.phone}</Fact>}
            {v.contactForm && (
              <Fact label="Kontaktformular">
                <Link href="/contact">Zum Kontaktformular</Link>
              </Fact>
            )}
          </FactList>
          {channels.length > 0 && (
            <p>
              Für eine schnelle elektronische Kontaktaufnahme {channels.length > 1 ? "stehen dir" : "steht dir"}{" "}
              {channels.join(" und ")} zur Verfügung.
              {v.contactForm && " Anfragen über das Formular werden als Ticket erfasst und bearbeitet."}
            </p>
          )}
        </LegalSection>
      )}

      {has("register") && (
        <LegalSection id="register" number={numberOf("register")} title={titleOf("register")}>
          {(showRegisterFact || showVatFact) && (
            <FactList>
              {showRegisterFact && <Fact label="Handelsregister / UID">{legal.register}</Fact>}
              {showVatFact && <Fact label="MWST-Nummer">{legal.vatId}</Fact>}
            </FactList>
          )}
          {v.register && legal.noRegister && <p>Der Verein ist nicht im Handelsregister eingetragen.</p>}
          {v.vat && legal.smallBusiness && (
            <p>
              Der Verein ist nicht mehrwertsteuerpflichtig; es wird keine Mehrwertsteuer ausgewiesen und keine
              MWST-Nummer angegeben.
            </p>
          )}
        </LegalSection>
      )}

      {has("haftung-inhalte") && (
        <LegalSection id="haftung-inhalte" number={numberOf("haftung-inhalte")} title={titleOf("haftung-inhalte")}>
          <p>
            Wir erstellen die Inhalte dieser Website mit grösster Sorgfalt. Wir übernehmen jedoch keine Gewähr für die
            Richtigkeit, Vollständigkeit, Aktualität und Verfügbarkeit der Inhalte und Dienste. Haftungsansprüche wegen
            Schäden, die aus der Nutzung oder Nichtnutzung der angebotenen Informationen oder aus Störungen und
            Ausfällen entstehen, sind ausgeschlossen, soweit das Gesetz dies zulässt.
          </p>
          <p>
            Wir behalten uns vor, Inhalte und Angebote ohne gesonderte Ankündigung zu ändern, zu ergänzen oder zu
            entfernen.
          </p>
        </LegalSection>
      )}

      {has("haftung-links") && (
        <LegalSection id="haftung-links" number={numberOf("haftung-links")} title={titleOf("haftung-links")}>
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für
            diese fremden Inhalte übernehmen wir keine Gewähr; verantwortlich ist stets der jeweilige Anbieter oder
            Betreiber der verlinkten Seite.
          </p>
          <p>
            Auf Inhalte verlinkter Seiten haben wir keinen Einfluss. Sobald wir von Rechtsverletzungen erfahren,
            entfernen wir den betreffenden Link.
          </p>
        </LegalSection>
      )}

      {has("urheberrecht") && (
        <LegalSection id="urheberrecht" number={numberOf("urheberrecht")} title={titleOf("urheberrecht")}>
          <p>
            Die von uns erstellten Inhalte und Werke auf dieser Website unterliegen dem Urheberrecht. Die Software hinter
            unseren Diensten wird, soweit nicht anders gekennzeichnet, unter den Lizenzen der jeweiligen
            Open-Source-Projekte bereitgestellt; es gelten die dort genannten Lizenzbedingungen.
          </p>
          <p>
            Beiträge Dritter sind als solche gekennzeichnet. Wenn du auf eine Urheberrechtsverletzung aufmerksam wirst,
            bitten wir um einen Hinweis über das <Link href="/contact">Kontaktformular</Link>. Wir entfernen betroffene
            Inhalte, sobald wir von der Verletzung erfahren.
          </p>
        </LegalSection>
      )}

      {has("datenschutz") && (
        <LegalSection id="datenschutz" number={numberOf("datenschutz")} title={titleOf("datenschutz")}>
          <p>
            Wie wir mit Personendaten umgehen, steht in der <Link href="/datenschutz">Datenschutzerklärung</Link>.
          </p>
        </LegalSection>
      )}
    </LegalPage>
  );
}
