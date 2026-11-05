import Link from "next/link";
import {
  LegalPage,
  LegalSection,
  type TocItem,
} from "@/components/legal/legal-page";
import { EmailValue, Fact, FactList } from "@/components/legal/provider-block";
import { legalUi } from "@/i18n/legal";
import { getMessages, getSite } from "@/i18n/server";
import { site as siteData } from "@/lib/site";
import { SITES } from "@/lib/sites";

// Schweizer Partnerverein (Stammdaten; englische Bezeichnung)
const partner = { ...siteData.partner, name: "VylarisGroup Switzerland" };

const toc: TocItem[] = [
  { id: "controller", title: "Controller" },
  { id: "overview", title: "Overview" },
  { id: "hosting", title: "Hosting and Server Log Files" },
  { id: "contact", title: "Contact Form and Ticket System" },
  { id: "account", title: "User Account: Registration and Sign-In" },
  { id: "mail", title: "Email Delivery" },
  { id: "newsletter", title: "Newsletter" },
  { id: "cookies", title: "Cookies, Session and Cookie Notice" },
  { id: "abuse", title: "Abuse Protection" },
  { id: "recipients", title: "Recipients and Data Processing on Our Behalf" },
  { id: "transfers", title: "Transfers to Third Countries" },
  { id: "links", title: "External Links" },
  { id: "rights", title: "Your Rights" },
  { id: "security", title: "Data Security" },
  { id: "changes", title: "Changes to This Policy" },
];

/** Englische Privacy Policy für vylaris.net: sinngemäße Fassung der deutschen Erklärung, Verantwortlicher ist VylarisGroupAmerica. */
export async function DatenschutzNet() {
  const site = await getSite();
  const ui = await getMessages(legalUi);
  const operator = SITES.eu;

  return (
    <LegalPage
      eyebrow={ui.eyebrow}
      title={ui.privacy.title}
      description="Transparent and brief: this is which personal data this website processes – and which it explicitly does not."
      toc={toc}
    >
      <LegalSection id="controller" number={1} title="Controller">
        <p>
          The controller responsible for data processing on this website is:
        </p>
        <address className="not-italic leading-relaxed">
          <strong>{site.name}</strong>
          <br />
          {site.jurisdiction}
        </address>
        <FactList>
          <Fact label="Email">
            <EmailValue email={site.contactEmail} />
          </Fact>
        </FactList>
        <p>
          The technical operation, hosting, and data processing for this website
          take place on infrastructure of {operator.name} (
          <a
            href={`https://${operator.domain}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {operator.domain}
          </a>
          ) in the European Union (see sections 3 and 10). For further
          information about the provider, see the{" "}
          <Link href="/imprint">Legal Notice</Link>.
        </p>
      </LegalSection>

      <LegalSection id="overview" number={2} title="Overview">
        <p>
          We keep the processing of personal data to a minimum. When you merely
          visit this website:
        </p>
        <ul>
          <li>
            We do not use any tracking or analytics tools and do not create
            usage profiles.
          </li>
          <li>
            We do not embed external fonts, content delivery networks, scripts,
            or advertising services. All resources are delivered from our own
            servers.
          </li>
          <li>
            Visitors who are not signed in do not receive any cookies. A cookie
            is only set after you sign in (see section 8).
          </li>
          <li>
            We do not measure whether or how you open or click our emails; there
            are no tracking pixels (see section 7).
          </li>
        </ul>
        <p>
          We only process personal data where this is technically necessary
          (section 3), where you contact us via the contact form (section 4),
          where you create and use a user account (sections 5 and 6), or where
          you subscribe to the newsletter (section 7).
        </p>
      </LegalSection>

      <LegalSection
        id="hosting"
        number={3}
        title="Hosting and Server Log Files"
      >
        <p>
          This website is operated on servers for which we are responsible. The
          technical operation takes place centrally on the infrastructure of{" "}
          {operator.name} in the European Union. When you open individual pages,
          your browser transmits technically necessary connection data, such as
          your IP address, the date and time of the request, the requested
          address, the response status, and information about your browser and
          operating system.
        </p>
        <p>
          This data is processed to deliver the pages, to ensure the stability
          and security of operations, and to defend against attacks. It is only
          kept for a short time and is not combined with other data sources. The
          legal basis is Art. 6(1)(f) GDPR; the legitimate interest lies in the
          secure and trouble-free operation of the service.
        </p>
      </LegalSection>

      <LegalSection
        id="contact"
        number={4}
        title="Contact Form and Ticket System"
      >
        <p>
          If you write to us through the{" "}
          <Link href="/contact">contact form</Link>, we create a ticket from
          your details. In doing so, we store:
        </p>
        <ul>
          <li>your name and email address</li>
          <li>
            the subject, category (General, B2B hosting, or security report),
            and message
          </li>
          <li>
            the automatically assigned ticket number as well as timestamps and
            processing status
          </li>
        </ul>
        <p>
          In addition, we may add internal notes for processing the ticket.
          These notes are not visible to you. Replies we send you about a ticket
          are stored with the ticket: the text of the reply, the name of the
          person replying, the time, and a note on whether the email was sent
          successfully (in case of an error, also the technical error message
          from the mail server).
        </p>
        <h3>Emails about your ticket</h3>
        <p>We send emails about your ticket to the address you provided:</p>
        <ul>
          <li>
            a confirmation of receipt with the ticket number once you have
            submitted the form,
          </li>
          <li>
            at the team&apos;s discretion, a notification when the processing
            status of your ticket changes,
          </li>
          <li>our replies to your request.</li>
        </ul>
        <p>
          In addition, for a new ticket an internal notification email may be
          sent to an address of the team stored by the operator. It contains the
          details of the new ticket and serves solely to ensure that the request
          is handled promptly. It is sent via the SMTP server described in
          section 6.
        </p>
        <h3>Purpose and legal basis</h3>
        <p>
          We process the data to answer and handle your request. Processing is
          based on your consent, which you give by ticking the consent checkbox
          in the form (Art. 6(1)(a) GDPR). If your request concerns hosting
          services and thus pre-contractual measures, Art. 6(1)(b) GDPR also
          applies. This also applies to the emails about your ticket
          (confirmation of receipt, status notifications, and replies), which
          serve to carry out your request; for security reports and other
          requests, we also rely on our legitimate interest in proper handling
          (Art. 6(1)(f) GDPR); the same applies to the internal notification
          email to the team.
        </p>
        <p>
          Providing the data is voluntary. Without the required fields, however,
          we cannot handle your request. You can withdraw your consent at any
          time with effect for the future (see section 13).
        </p>
        <h3>Storage period</h3>
        <p>
          We store your details for as long as necessary to handle your request
          and, where statutory retention obligations apply, for the duration of
          those periods. After that, they are deleted. This also applies to the
          replies stored with the ticket.
        </p>
      </LegalSection>

      <LegalSection
        id="account"
        number={5}
        title="User Account: Registration and Sign-In"
      >
        <p>
          You can create a user account on this website if the operator has
          enabled registration. Registration is voluntary; you can use all
          public content without an account.
        </p>
        <h3>Data processed</h3>
        <ul>
          <li>the name and email address you provide when registering</li>
          <li>
            your password, exclusively as a salted bcrypt hash; it is never
            stored in plain text
          </li>
          <li>
            timestamps of your registration, the confirmation of your email
            address, and your last sign-in
          </li>
          <li>
            one-time links for email confirmation and password reset, which we
            store only as a hash; they are valid for 48 hours (confirmation) or
            1 hour (password reset)
          </li>
        </ul>
        <h3>Purpose and legal basis</h3>
        <p>
          We process this data to set up and manage your account, to verify your
          email address, to sign you in, and to reset your access if needed. The
          legal basis is Art. 6(1)(b) GDPR (the user relationship regarding the
          account).
        </p>
        <h3>Storage period and deletion</h3>
        <p>
          We store the account data until your account is deleted. You can
          delete your account yourself at any time from your account area.
          Statutory retention obligations remain unaffected.
        </p>
      </LegalSection>

      <LegalSection id="mail" number={6} title="Email Delivery">
        <p>
          We send emails in connection with the user account (confirmation
          emails upon registration, password reset emails, and informational
          emails about your account), about tickets (see section 4), and, if you
          have subscribed, the newsletter (see section 7). In doing so, your
          email address, where applicable your name, and the respective message
          content (such as a confirmation or reset link) are processed.
        </p>
        <p>
          Emails are sent via the SMTP server set up by the operator of this
          website, that is, via its own mail server or the operator&apos;s email
          provider. We do not pass the data on to any further third parties in
          the process. The legal basis is Art. 6(1)(b) GDPR; for the newsletter,
          section 7 applies.
        </p>
      </LegalSection>

      <LegalSection id="newsletter" number={7} title="Newsletter">
        <p>
          If the newsletter is enabled on this website, you can subscribe to it.
          Subscribing is voluntary; you can use all content and features of the
          website without the newsletter.
        </p>
        <h3>Purpose and legal basis</h3>
        <p>
          We use your data to send you news about our offerings and the website
          by email. The legal basis is your consent (Art. 6(1)(a) GDPR), which
          you give by subscribing and confirming your email address.
        </p>
        <h3>Double opt-in subscription</h3>
        <p>
          After you subscribe, we send you an email with a confirmation link.
          Your subscription only becomes effective, and you only receive the
          newsletter, once you open this link. This ensures that nobody can
          enter addresses that are not theirs. The confirmation link is only
          valid for a limited time; an unconfirmed subscription is not used any
          further once the link has expired, and no newsletters are sent to that
          address.
        </p>
        <h3>Data stored</h3>
        <ul>
          <li>
            your email address and, if you provide it, your name (optional)
          </li>
          <li>
            the time of your consent (subscription) and the time of
            confirmation, as proof of consent (Art. 7(1) GDPR)
          </li>
          <li>
            the status of your subscription (pending, active, or unsubscribed)
            and, in case of unsubscribing, the time of unsubscribing
          </li>
          <li>
            the confirmation link, which we store only as a hash, and a randomly
            generated unsubscribe token that is part of the unsubscribe link in
            every email
          </li>
          <li>
            for each newsletter issue (campaign), the delivery status, that is,
            whether sending to your address succeeded or failed, with the time
            and, where applicable, the technical error message from the mail
            server
          </li>
        </ul>
        <p>
          We do <strong>not</strong> carry out any performance measurement: we
          record neither whether you open an email nor whether or on what you
          click in it. We do not use tracking pixels or counting or redirect
          links to evaluate your behavior.
        </p>
        <h3>Delivery</h3>
        <p>
          The newsletter is sent via the SMTP server set up by the operator of
          this website (see section 6). It is not passed on to any further third
          parties.
        </p>
        <h3>Withdrawal and unsubscribing</h3>
        <p>
          You can withdraw your consent at any time with effect for the future.
          Every newsletter email contains an unsubscribe link for this purpose,
          with which you can unsubscribe in one click. We also support the
          unsubscribe function of your email client (one-click unsubscribe via
          the &quot;List-Unsubscribe&quot; header). Alternatively, a message to
          the email address given in section 1 is sufficient. The lawfulness of
          the processing carried out until withdrawal remains unaffected.
        </p>
        <h3>Storage period</h3>
        <p>
          We store your data until you withdraw your consent. After you
          unsubscribe, we keep your email address on file as unsubscribed so
          that you are not accidentally sent newsletters again and your
          withdrawal remains provable (Art. 6(1)(f) GDPR). If you want us to
          delete your data completely, let us know (section 13); we will then
          delete it unless statutory retention obligations prevent this. Please
          note that this also removes the protection against being sent
          newsletters again.
        </p>
      </LegalSection>

      <LegalSection
        id="cookies"
        number={8}
        title="Cookies, Session and Cookie Notice"
      >
        <p>
          Visitors who are not signed in do not receive any cookies. After a
          successful sign-in, we set the technically necessary cookie{" "}
          <code>vge_session</code>.
        </p>
        <ul>
          <li>
            It is marked <code>httpOnly</code>, so it cannot be read by
            JavaScript, and has <code>SameSite=Lax</code> and{" "}
            <code>Secure</code> (encrypted connections only).
          </li>
          <li>
            It contains only a signed session token with account ID, name, email
            address, and role.
          </li>
          <li>
            Its lifetime is at most 14 days. It is removed when you sign out.
          </li>
        </ul>
        <p>
          Storing and reading this cookie is strictly necessary to provide the
          service you expressly requested, namely signing in. The related
          processing is based on Art. 6(1)(b) GDPR. A consent prompt is not
          required for this.
        </p>
        <h3>Cookie notice and settings</h3>
        <p>
          When you visit the website, we show a cookie notice in which you can
          learn about the cookies in use and adjust your settings. At present,
          we only use the strictly necessary cookie mentioned above; analytics
          and marketing cookies are not used. If we introduced optional
          categories in the future, we would only activate them with your prior
          consent.
        </p>
        <p>
          We store your choice in the cookie notice exclusively locally in your
          browser, namely in Local Storage under the key{" "}
          <code>vge-consent-v1</code>. This is not a cookie. The entry is not
          transmitted to us or to third parties and serves only to avoid asking
          you again on every visit. You can delete it at any time in your
          browser settings; the notice will then be shown again. Storing this
          choice is necessary so that your decision can be respected; the legal
          basis for the processing is Art. 6(1)(f) GDPR.
        </p>
        <p>
          You can change your settings at any time: the &quot;Cookie
          settings&quot; link in the website footer reopens the settings dialog.
        </p>
      </LegalSection>

      <LegalSection id="abuse" number={9} title="Abuse Protection">
        <p>
          To protect the contact form as well as sign-in, registration, and
          password reset from automated abuse, we limit the number of requests
          per time period. For this purpose, your IP address (for sign-in and
          registration partly in combination with the email address entered) is
          processed transiently in the server&apos;s working memory. It is not
          stored permanently and not saved in the database; after the time
          window has passed or the service has restarted, it no longer exists.
        </p>
        <p>
          In addition, the contact form contains a field that is invisible to
          humans (honeypot). It serves only to detect automated submissions and
          does not collect any personal data. The legal basis is Art. 6(1)(f)
          GDPR (protection against abuse and securing operations).
        </p>
      </LegalSection>

      <LegalSection
        id="recipients"
        number={10}
        title="Recipients and Data Processing on Our Behalf"
      >
        <p>
          Your data is processed on the servers of {operator.name} in the
          European Union, which operates this website technically and centrally
          on our behalf. For information about {operator.name}, see its{" "}
          <a
            href={`https://${operator.domain}/datenschutz`}
            target="_blank"
            rel="noopener noreferrer"
          >
            privacy policy
          </a>{" "}
          (in German). Beyond that, we do not pass your data on to third parties
          unless we are legally obliged to do so. One exception is email
          delivery via the SMTP server configured by the operator (section 6);
          the emails about tickets (section 4) and the newsletter (section 7)
          are also sent through it. Internally, access is only granted to those
          staff who manage requests, accounts, and newsletter subscriptions,
          send messages, or ensure operations.
        </p>
      </LegalSection>

      <LegalSection
        id="transfers"
        number={11}
        title="Transfers to Third Countries"
      >
        <p>
          This website does not itself transfer personal data to other
          countries. The decisive factor for email delivery is the location of
          the mail server used by the operator; if it is located outside the
          European Union or the European Economic Area, the operator ensures
          appropriate safeguards in accordance with Art. 44 et seq. GDPR.
        </p>
      </LegalSection>

      <LegalSection id="links" number={12} title="External Links">
        <p>
          This website links to external sites, in particular to our partner
          association {partner.name} (
          <a href={partner.url} target="_blank" rel="noopener noreferrer">
            {partner.domain}
          </a>
          ). Merely displaying our pages does not transmit any data to these
          sites. Only when you follow a link do the privacy rules of the
          respective operator apply; we have no influence over them.
        </p>
      </LegalSection>

      <LegalSection id="rights" number={13} title="Your Rights">
        <p>
          If you are located in the EU/EEA, the GDPR gives you the following
          rights:
        </p>
        <ul>
          <li>access to the data stored about you (Art. 15 GDPR)</li>
          <li>rectification of inaccurate data (Art. 16 GDPR)</li>
          <li>erasure of your data (Art. 17 GDPR)</li>
          <li>restriction of processing (Art. 18 GDPR)</li>
          <li>data portability (Art. 20 GDPR)</li>
          <li>
            objection to processing based on legitimate interests (Art. 21 GDPR)
          </li>
        </ul>
        <p>
          You can withdraw any consent you have given at any time with effect
          for the future (Art. 7(3) GDPR). The lawfulness of the processing
          carried out until then remains unaffected. The easiest way to withdraw
          your newsletter consent is via the unsubscribe link in every
          newsletter email (section 7).
        </p>
        <p>
          To exercise your rights, a message to the email address given in
          section 1 or via the <Link href="/contact">contact form</Link> is
          sufficient. You also have the right to lodge a complaint with a data
          protection supervisory authority (Art. 77 GDPR), in particular in the
          Member State of your habitual residence, your place of work, or the
          place of the alleged infringement.
        </p>
      </LegalSection>

      <LegalSection id="security" number={14} title="Data Security">
        <p>
          Transmission between your browser and our servers is encrypted using
          TLS (recognizable by the padlock symbol or &quot;https&quot;).
          Passwords are stored exclusively as a hash, and so are one-time links
          for confirmation (including confirmation of the newsletter
          subscription) and password reset. Access to stored requests, accounts,
          and newsletter subscriptions is restricted to authorized persons. We
          continuously adapt our technical and organizational measures to the
          state of the art.
        </p>
      </LegalSection>

      <LegalSection id="changes" number={15} title="Changes to This Policy">
        <p>
          We update this privacy policy when the website, our services, or the
          legal situation change. The version published here applies in each
          case.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
