import {
  LegalPage,
  LegalSection,
  type TocItem,
} from "@/components/legal/legal-page";
import { EmailValue, Fact, FactList } from "@/components/legal/provider-block";
import { legalUi } from "@/i18n/legal";
import { getMessages, getSite } from "@/i18n/server";
import { SITES } from "@/lib/sites";

const toc: TocItem[] = [
  { id: "contact", title: "Contact Information" },
  { id: "disclaimer", title: "General Disclaimer" },
  { id: "external-links", title: "Liability for External Links" },
  { id: "operation", title: "Technical Operation" },
];

/** Englische Legal Notice für vylaris.net (US-Fassung: keine ladungsfähige Anschrift, Kontakt per E-Mail). */
export async function ImpressumNet() {
  const site = await getSite();
  const ui = await getMessages(legalUi);
  const operator = SITES.eu;

  return (
    <LegalPage
      eyebrow={ui.eyebrow}
      title={ui.imprint.title}
      description={`Important legal information and contact details for ${site.name}.`}
      toc={toc}
    >
      <LegalSection id="contact" number={1} title="Contact Information">
        <FactList>
          <Fact label="Platform Name">{site.name}</Fact>
          <Fact label="Location / Jurisdiction">{site.jurisdiction}</Fact>
          <Fact label="Primary Email">
            <EmailValue email={site.contactEmail} />
          </Fact>
        </FactList>
        <p>
          Please note: {site.name} is operated strictly as an independent,
          non-commercial hobbyist service. We do not sell physical goods,
          digital assets, or charge for our basic platform usage. Therefore,
          under applicable jurisdiction, a physical address is not provided.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" number={2} title="General Disclaimer">
        <p>
          All information and services on this website are provided &quot;as
          is&quot; and without any warranties of any kind, whether express or
          implied. {site.name} does not warrant or guarantee that the website
          and its services will be error-free, constantly available, or
          completely secure against unauthorized access or malicious attacks.
        </p>
        <p>
          We explicitly disclaim any liability for damages, whether direct,
          indirect, incidental, or consequential, arising from the use or
          inability to use this website. Use of {site.name} is entirely at your
          own risk.
        </p>
      </LegalSection>

      <LegalSection
        id="external-links"
        number={3}
        title="Liability for External Links"
      >
        <p>
          Our website contains links to external third-party websites. We have
          no control over the content or security of these external sites. As
          such, we cannot assume any liability for the content or privacy
          practices of these linked sites. The provider or operator of the
          respective external site is always responsible for its content. A
          permanent control of the linked pages is unreasonable without concrete
          evidence of a violation of the law.
        </p>
      </LegalSection>

      <LegalSection id="operation" number={4} title="Technical Operation">
        <p>
          The technical operation, hosting, and administration of this website
          are carried out centrally by {operator.name} (
          <a
            href={`https://${operator.domain}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {operator.domain}
          </a>
          ). For information about {operator.name}, see its{" "}
          <a
            href={`https://${operator.domain}/impressum`}
            target="_blank"
            rel="noopener noreferrer"
          >
            legal notice
          </a>{" "}
          (in German).
        </p>
      </LegalSection>
    </LegalPage>
  );
}
