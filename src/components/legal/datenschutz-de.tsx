import Link from "next/link";
import {
  LegalPage,
  LegalSection,
  type TocItem,
} from "@/components/legal/legal-page";
import { EmailValue, ProviderAddress } from "@/components/legal/provider-block";
import { legalUi } from "@/i18n/legal";
import { getMessages, getSite } from "@/i18n/server";
import { getLegal } from "@/lib/legal";
import { site as siteData } from "@/lib/site";
import { SITES } from "@/lib/sites";

// Schweizer Partnerverein (Stammdaten)
const partner = siteData.partner;

const toc: TocItem[] = [
  { id: "verantwortlicher", title: "Verantwortlicher" },
  { id: "ueberblick", title: "Überblick" },
  { id: "hosting", title: "Hosting und Server-Logfiles" },
  { id: "kontakt", title: "Kontaktformular und Ticket-System" },
  { id: "konto", title: "Nutzerkonto: Registrierung und Anmeldung" },
  { id: "mail", title: "E-Mail-Versand" },
  { id: "newsletter", title: "Newsletter" },
  { id: "cookies", title: "Cookies, Sitzung und Cookie-Hinweis" },
  { id: "missbrauchsschutz", title: "Missbrauchsschutz" },
  { id: "empfaenger", title: "Empfänger und Auftragsverarbeitung" },
  { id: "drittland", title: "Drittlandübermittlung" },
  { id: "links", title: "Externe Links" },
  { id: "rechte", title: "Deine Rechte" },
  { id: "sicherheit", title: "Datensicherheit" },
  { id: "aenderungen", title: "Änderungen dieser Erklärung" },
];

/** Deutsche Fassung (vylaris.eu und vylaris.de): Verantwortlicher aus den Admin-Einstellungen; auf vylaris.de zusätzlich Ansprechpartner. */
export async function DatenschutzDe() {
  const legal = await getLegal();
  const site = await getSite();
  const ui = await getMessages(legalUi);
  const provider = SITES.eu;
  const isDe = site.key === "de";

  return (
    <LegalPage
      eyebrow={ui.eyebrow}
      title={ui.privacy.title}
      description="Transparent und knapp: Hier steht, welche personenbezogenen Daten diese Website verarbeitet – und welche ausdrücklich nicht."
      toc={toc}
    >
      <LegalSection id="verantwortlicher" number={1} title="Verantwortlicher">
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne
          der Datenschutz-Grundverordnung (DSGVO) ist:
        </p>
        <ProviderAddress legal={legal} name={provider.name} />
        <p>
          {isDe ? (
            <>
              Vertreten durch: {site.leader.name}, Leitung {site.name}
              <br />
              Unternehmen / Marke: {provider.name}, Leitung {legal.responsible}
            </>
          ) : (
            <>
              Vertreten durch: {legal.responsible} ({provider.leader.company})
            </>
          )}
          <br />
          E-Mail: <EmailValue email={legal.email} />
          {legal.phone && (
            <>
              <br />
              Telefon: {legal.phone}
            </>
          )}
        </p>
        <p>
          Weitere Angaben zum Anbieter findest du im{" "}
          <Link href="/impressum">Impressum</Link>.
        </p>
        {isDe && (
          <p>
            Die Website von {site.name} ({site.domain}) wird technisch und
            organisatorisch zentral über {provider.name} (
            <a
              href={`https://${provider.domain}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {provider.domain}
            </a>
            ) betrieben. Verantwortlicher im Sinne der DSGVO ist derselbe wie
            dort.
          </p>
        )}
      </LegalSection>

      <LegalSection id="ueberblick" number={2} title="Überblick">
        <p>
          Wir halten die Verarbeitung personenbezogener Daten so gering wie
          möglich. Beim reinen Besuch dieser Website gilt:
        </p>
        <ul>
          <li>
            Wir setzen keine Tracking- oder Analyse-Werkzeuge ein und erstellen
            keine Nutzungsprofile.
          </li>
          <li>
            Wir binden keine externen Schriftarten, Content-Delivery-Netzwerke,
            Skripte oder Werbe-Dienste ein. Alle Ressourcen werden von unseren
            eigenen Servern ausgeliefert.
          </li>
          <li>
            Besucherinnen und Besucher ohne Anmeldung erhalten keine Cookies.
            Ein Cookie wird erst nach einer Anmeldung gesetzt (siehe Abschnitt
            8).
          </li>
          <li>
            Wir messen nicht, ob und wie du unsere E-Mails öffnest oder darin
            klickst; es gibt keine Tracking-Pixel (siehe Abschnitt 7).
          </li>
        </ul>
        <p>
          Personenbezogene Daten verarbeiten wir nur, soweit dies technisch
          erforderlich ist (Abschnitt 3), du uns über das Kontaktformular
          kontaktierst (Abschnitt 4), du ein Nutzerkonto anlegst und verwendest
          (Abschnitte 5 und 6) oder du dich für den Newsletter anmeldest
          (Abschnitt 7).
        </p>
      </LegalSection>

      <LegalSection id="hosting" number={3} title="Hosting und Server-Logfiles">
        {isDe && (
          <p>
            Betrieb, Hosting und Verwaltung dieser Website erfolgen zentral über{" "}
            {provider.name} ({provider.domain}); die Daten werden dort auf der
            Infrastruktur von {provider.name} verarbeitet.
          </p>
        )}
        <p>
          Diese Website wird auf Servern betrieben, die wir selbst verantworten.
          Beim Aufruf einzelner Seiten übermittelt dein Browser technisch
          notwendige Verbindungsdaten, etwa deine IP-Adresse, Datum und Uhrzeit
          der Anfrage, die angeforderte Adresse, den Antwortstatus sowie Angaben
          zu Browser und Betriebssystem.
        </p>
        <p>
          Diese Daten werden verarbeitet, um die Seiten auszuliefern, die
          Stabilität und Sicherheit des Betriebs zu gewährleisten und Angriffe
          abzuwehren. Sie werden nur kurzfristig vorgehalten und nicht mit
          anderen Datenquellen zusammengeführt. Rechtsgrundlage ist Art. 6 Abs.
          1 lit. f DSGVO; das berechtigte Interesse liegt im sicheren und
          störungsfreien Betrieb des Angebots.
        </p>
      </LegalSection>

      <LegalSection
        id="kontakt"
        number={4}
        title="Kontaktformular und Ticket-System"
      >
        <p>
          Wenn du uns über das <Link href="/contact">Kontaktformular</Link>{" "}
          schreibst, legen wir aus deinen Angaben ein Ticket an. Dabei speichern
          wir:
        </p>
        <ul>
          <li>Name und E-Mail-Adresse</li>
          <li>
            Betreff, Kategorie (Allgemein, B2B-Hosting oder Security-Report) und
            Nachricht
          </li>
          <li>
            die automatisch vergebene Ticketnummer sowie Zeitstempel und
            Bearbeitungsstatus
          </li>
        </ul>
        <p>
          Zusätzlich können wir interne Notizen zur Bearbeitung des Tickets
          hinterlegen. Diese Notizen sind für dich nicht sichtbar. Antworten,
          die wir dir zu einem Ticket schicken, speichern wir am Ticket: den
          Text der Antwort, den Namen der antwortenden Person, den Zeitpunkt
          sowie den Vermerk, ob der E-Mail-Versand erfolgreich war (bei einem
          Fehler zusätzlich die technische Fehlermeldung des Mailservers).
        </p>
        <h3>E-Mails zum Ticket</h3>
        <p>
          Zu deinem Ticket versenden wir E-Mails an die von dir angegebene
          Adresse:
        </p>
        <ul>
          <li>
            eine Eingangsbestätigung mit der Ticketnummer, sobald du das
            Formular abgeschickt hast,
          </li>
          <li>
            auf Wunsch des Teams eine Information, wenn sich der
            Bearbeitungsstatus deines Tickets ändert,
          </li>
          <li>unsere Antworten auf deine Anfrage.</li>
        </ul>
        <p>
          Außerdem kann bei einem neuen Ticket eine interne Hinweis-E-Mail an
          eine vom Betreiber hinterlegte Adresse des Teams gesendet werden. Sie
          enthält die Angaben zum neuen Ticket und dient allein dazu, dass die
          Anfrage zeitnah bearbeitet wird. Der Versand erfolgt über den in
          Abschnitt 6 beschriebenen SMTP-Server.
        </p>
        <h3>Zweck und Rechtsgrundlage</h3>
        <p>
          Wir verarbeiten die Daten, um deine Anfrage zu beantworten und zu
          bearbeiten. Die Verarbeitung erfolgt auf Grundlage deiner
          Einwilligung, die du durch das Setzen der Einwilligungs-Checkbox im
          Formular erteilst (Art. 6 Abs. 1 lit. a DSGVO). Zielt deine Anfrage
          auf Hosting-Leistungen und damit auf vorvertragliche Maßnahmen ab, ist
          zusätzlich Art. 6 Abs. 1 lit. b DSGVO einschlägig. Das gilt auch für
          die E-Mails zum Ticket (Eingangsbestätigung, Statusinformationen und
          Antworten), die der Durchführung deiner Anfrage dienen; bei
          Sicherheitsmeldungen und sonstigen Anfragen stützen wir uns außerdem
          auf unser berechtigtes Interesse an einer ordnungsgemäßen Bearbeitung
          (Art. 6 Abs. 1 lit. f DSGVO); dasselbe gilt für die interne
          Hinweis-E-Mail an das Team.
        </p>
        <p>
          Die Angabe der Daten ist freiwillig. Ohne die Pflichtfelder können wir
          dein Anliegen allerdings nicht bearbeiten. Deine Einwilligung kannst
          du jederzeit mit Wirkung für die Zukunft widerrufen (siehe Abschnitt
          13).
        </p>
        <h3>Speicherdauer</h3>
        <p>
          Wir speichern deine Angaben so lange, wie es zur Bearbeitung deiner
          Anfrage erforderlich ist, und, soweit gesetzliche
          Aufbewahrungspflichten bestehen, für die Dauer dieser Fristen. Danach
          werden sie gelöscht. Das gilt auch für die am Ticket gespeicherten
          Antworten.
        </p>
      </LegalSection>

      <LegalSection
        id="konto"
        number={5}
        title="Nutzerkonto: Registrierung und Anmeldung"
      >
        <p>
          Du kannst auf dieser Website ein Nutzerkonto anlegen, sofern der
          Betreiber die Registrierung aktiviert hat. Die Registrierung ist
          freiwillig; alle öffentlichen Inhalte kannst du auch ohne Konto
          nutzen.
        </p>
        <h3>Verarbeitete Daten</h3>
        <ul>
          <li>Name und E-Mail-Adresse, die du bei der Registrierung angibst</li>
          <li>
            dein Passwort ausschließlich als gesalzener bcrypt-Hash; im Klartext
            wird es zu keinem Zeitpunkt gespeichert
          </li>
          <li>
            Zeitstempel der Registrierung, der Bestätigung deiner E-Mail-Adresse
            und deiner letzten Anmeldung
          </li>
          <li>
            Einmal-Links für die E-Mail-Bestätigung und das Zurücksetzen des
            Passworts, die wir nur als Hash speichern; sie sind 48 Stunden
            (Bestätigung) bzw. 1 Stunde (Passwort-Reset) gültig
          </li>
        </ul>
        <h3>Zweck und Rechtsgrundlage</h3>
        <p>
          Wir verarbeiten diese Daten, um dein Konto einzurichten und zu führen,
          deine E-Mail-Adresse zu verifizieren, dich anzumelden und dir bei
          Bedarf den Zugang zurückzusetzen. Rechtsgrundlage ist Art. 6 Abs. 1
          lit. b DSGVO (Nutzungsverhältnis zum Konto).
        </p>
        <h3>Speicherdauer und Löschung</h3>
        <p>
          Wir speichern die Kontodaten bis zur Löschung deines Kontos. Du kannst
          dein Konto jederzeit selbst unter „Konto“ löschen. Gesetzliche
          Aufbewahrungspflichten bleiben unberührt.
        </p>
      </LegalSection>

      <LegalSection id="mail" number={6} title="E-Mail-Versand">
        <p>
          Wir versenden E-Mails im Zusammenhang mit dem Nutzerkonto
          (Bestätigungs-E-Mails bei der Registrierung, E-Mails zum Zurücksetzen
          des Passworts und Informations-E-Mails zu deinem Konto), zu Tickets
          (siehe Abschnitt 4) und, wenn du dich angemeldet hast, den Newsletter
          (siehe Abschnitt 7). Dabei werden deine E-Mail-Adresse, gegebenenfalls
          dein Name sowie der jeweilige Nachrichteninhalt (etwa ein
          Bestätigungs- oder Rücksetz-Link) verarbeitet.
        </p>
        <p>
          Der Versand erfolgt über den SMTP-Server, den der Betreiber dieser
          Website eingerichtet hat, das heißt über einen eigenen Mailserver oder
          den E-Mail-Anbieter des Betreibers. Eine Weitergabe der Daten an
          weitere Dritte durch uns findet dabei nicht statt. Rechtsgrundlage ist
          Art. 6 Abs. 1 lit. b DSGVO; für den Newsletter gilt Abschnitt 7.
        </p>
      </LegalSection>

      <LegalSection id="newsletter" number={7} title="Newsletter">
        <p>
          Wenn der Newsletter auf dieser Website aktiviert ist, kannst du dich
          dafür anmelden. Die Anmeldung ist freiwillig; alle Inhalte und
          Funktionen der Website kannst du auch ohne Newsletter nutzen.
        </p>
        <h3>Zweck und Rechtsgrundlage</h3>
        <p>
          Wir verwenden deine Daten, um dir per E-Mail Neuigkeiten zu unseren
          Angeboten und zur Website zuzusenden. Rechtsgrundlage ist deine
          Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du mit der Anmeldung
          und der Bestätigung deiner E-Mail-Adresse erteilst.
        </p>
        <h3>Anmeldung im Double-Opt-In-Verfahren</h3>
        <p>
          Nach der Anmeldung senden wir dir eine E-Mail mit einem
          Bestätigungslink. Erst wenn du diesen Link aufrufst, ist deine
          Anmeldung wirksam und du erhältst den Newsletter. So stellen wir
          sicher, dass niemand fremde Adressen einträgt. Der Bestätigungslink
          ist nur begrenzt gültig; eine nicht bestätigte Anmeldung wird nach
          Ablauf des Links nicht weiter genutzt, und es werden keine Newsletter
          an diese Adresse gesendet.
        </p>
        <h3>Gespeicherte Daten</h3>
        <ul>
          <li>
            deine E-Mail-Adresse und, wenn du ihn angibst, dein Name
            (freiwillig)
          </li>
          <li>
            der Zeitpunkt deiner Einwilligung (Anmeldung) und der Zeitpunkt der
            Bestätigung, als Nachweis der Einwilligung (Art. 7 Abs. 1 DSGVO)
          </li>
          <li>
            der Status deiner Anmeldung (ausstehend, aktiv oder abgemeldet)
            sowie, im Fall einer Abmeldung, deren Zeitpunkt
          </li>
          <li>
            der Bestätigungslink, den wir nur als Hash speichern, und ein
            zufällig erzeugter Abmelde-Token, der Bestandteil des Abmelde-Links
            in jeder E-Mail ist
          </li>
          <li>
            je Newsletter-Ausgabe (Kampagne) der Zustellstatus, also ob der
            Versand an deine Adresse erfolgreich war oder fehlgeschlagen ist,
            mit dem Zeitpunkt und gegebenenfalls der technischen Fehlermeldung
            des Mailservers
          </li>
        </ul>
        <p>
          Wir führen <strong>keine</strong> Erfolgsmessung durch: Es wird weder
          erfasst, ob du eine E-Mail öffnest, noch, ob oder worauf du darin
          klickst. Wir verwenden keine Tracking-Pixel und keine Zähl- oder
          Weiterleitungslinks zur Auswertung deines Verhaltens.
        </p>
        <h3>Versand</h3>
        <p>
          Der Newsletter wird über den SMTP-Server versendet, den der Betreiber
          dieser Website eingerichtet hat (siehe Abschnitt 6). Eine Weitergabe
          an weitere Dritte findet nicht statt.
        </p>
        <h3>Widerruf und Abmeldung</h3>
        <p>
          Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft
          widerrufen. Jede Newsletter-E-Mail enthält dazu einen Abmelde-Link,
          über den du dich mit einem Klick abmelden kannst. Darüber hinaus
          unterstützen wir die Abmeldefunktion deines E-Mail-Programms
          (One-Click-Abmeldung über den Header „List-Unsubscribe“). Alternativ
          genügt eine Nachricht an die unter Abschnitt 1 genannte
          E-Mail-Adresse. Die Rechtmäßigkeit der bis zum Widerruf erfolgten
          Verarbeitung bleibt unberührt.
        </p>
        <h3>Speicherdauer</h3>
        <p>
          Wir speichern deine Daten, bis du deine Einwilligung widerrufst. Nach
          der Abmeldung führen wir deine E-Mail-Adresse als abgemeldet weiter,
          damit dir nicht versehentlich erneut Newsletter zugesendet werden und
          dein Widerruf nachweisbar bleibt (Art. 6 Abs. 1 lit. f DSGVO).
          Möchtest du, dass wir deine Daten vollständig löschen, teile uns das
          mit (Abschnitt 13); wir löschen sie dann, soweit keine gesetzlichen
          Aufbewahrungspflichten entgegenstehen. Bitte beachte, dass damit auch
          der Schutz vor einer erneuten Zusendung entfällt.
        </p>
      </LegalSection>

      <LegalSection
        id="cookies"
        number={8}
        title="Cookies, Sitzung und Cookie-Hinweis"
      >
        <p>
          Besucherinnen und Besucher ohne Anmeldung erhalten keine Cookies. Nach
          einer erfolgreichen Anmeldung setzen wir den technisch notwendigen
          Cookie <code>vge_session</code>.
        </p>
        <ul>
          <li>
            Er ist als <code>httpOnly</code> gekennzeichnet, für JavaScript also
            nicht auslesbar, und mit <code>SameSite=Lax</code> sowie{" "}
            <code>Secure</code> (nur über verschlüsselte Verbindungen) versehen.
          </li>
          <li>
            Er enthält ausschließlich ein signiertes Sitzungstoken mit
            Konto-Kennung, Name, E-Mail-Adresse und Rolle.
          </li>
          <li>
            Seine Laufzeit beträgt höchstens 14 Tage. Beim Abmelden wird er
            entfernt.
          </li>
        </ul>
        <p>
          Das Speichern bzw. Auslesen dieses Cookies ist unbedingt erforderlich,
          damit der von dir ausdrücklich angeforderte Dienst, nämlich die
          Anmeldung, bereitgestellt werden kann (§ 25 Abs. 2 Nr. 2 TDDDG). Die
          zugehörige Verarbeitung beruht auf Art. 6 Abs. 1 lit. b DSGVO. Eine
          Einwilligungsabfrage ist dafür nicht erforderlich.
        </p>
        <h3>Cookie-Hinweis und Einstellungen</h3>
        <p>
          Beim Besuch der Website blenden wir einen Cookie-Hinweis ein, in dem
          du dich über die eingesetzten Cookies informieren und deine
          Einstellungen vornehmen kannst. Derzeit setzen wir ausschließlich den
          oben genannten, technisch notwendigen Cookie ein; Analyse- und
          Marketing-Cookies kommen nicht zum Einsatz. Würden wir künftig
          optionale Kategorien einführen, würden wir sie nur mit deiner
          vorherigen Einwilligung aktivieren.
        </p>
        <p>
          Deine Auswahl im Cookie-Hinweis speichern wir ausschließlich lokal in
          deinem Browser, und zwar im Local Storage unter dem Schlüssel{" "}
          <code>vge-consent-v1</code>. Das ist kein Cookie. Der Eintrag wird
          nicht an uns oder an Dritte übertragen und dient allein dazu, dich
          nicht bei jedem Besuch erneut zu fragen. Du kannst ihn jederzeit in
          den Einstellungen deines Browsers löschen; dann wird der Hinweis
          wieder angezeigt. Das Speichern dieser Auswahl ist erforderlich, damit
          deine Entscheidung berücksichtigt werden kann (§ 25 Abs. 2 Nr. 2
          TDDDG); Rechtsgrundlage der Verarbeitung ist Art. 6 Abs. 1 lit. f
          DSGVO.
        </p>
        <p>
          Deine Einstellungen kannst du jederzeit ändern: Über den Link
          „Cookie-Einstellungen“ im Footer der Website öffnest du den
          Einstellungs-Dialog erneut.
        </p>
      </LegalSection>

      <LegalSection id="missbrauchsschutz" number={9} title="Missbrauchsschutz">
        <p>
          Um das Kontaktformular sowie Anmeldung, Registrierung und
          Passwort-Reset vor automatisiertem Missbrauch zu schützen, begrenzen
          wir die Zahl der Anfragen pro Zeitraum. Dafür wird deine IP-Adresse
          (bei Anmeldung und Registrierung teilweise zusätzlich in Verbindung
          mit der eingegebenen E-Mail-Adresse) flüchtig im Arbeitsspeicher des
          Servers verarbeitet. Sie wird nicht dauerhaft gespeichert und nicht in
          der Datenbank abgelegt; nach Ablauf des Zeitfensters oder einem
          Neustart des Dienstes ist sie nicht mehr vorhanden.
        </p>
        <p>
          Zusätzlich enthält das Kontaktformular ein für Menschen unsichtbares
          Feld (Honeypot). Es dient allein dazu, automatisierte Einsendungen zu
          erkennen, und erhebt keine personenbezogenen Daten. Rechtsgrundlage
          ist Art. 6 Abs. 1 lit. f DSGVO (Schutz vor Missbrauch und Sicherung
          des Betriebs).
        </p>
      </LegalSection>

      <LegalSection
        id="empfaenger"
        number={10}
        title="Empfänger und Auftragsverarbeitung"
      >
        <p>
          Deine Daten werden auf unseren eigenen Servern verarbeitet. Eine
          Weitergabe an Dritte findet nicht statt, es sei denn, wir sind dazu
          gesetzlich verpflichtet. Eine Ausnahme bildet der E-Mail-Versand über
          den vom Betreiber konfigurierten SMTP-Server (Abschnitt 6); über ihn
          laufen auch die Mails zu Tickets (Abschnitt 4) und der Newsletter
          (Abschnitt 7). Intern erhalten nur diejenigen Mitarbeitenden Zugriff,
          die Anfragen, Konten und Newsletter-Anmeldungen verwalten,
          Mitteilungen versenden oder den Betrieb sicherstellen.
        </p>
      </LegalSection>

      <LegalSection id="drittland" number={11} title="Drittlandübermittlung">
        <p>
          Eine Übermittlung personenbezogener Daten in Länder außerhalb der
          Europäischen Union bzw. des Europäischen Wirtschaftsraums findet durch
          diese Website nicht statt. Maßgeblich für den E-Mail-Versand ist der
          Standort des vom Betreiber eingesetzten Mailservers; bei einem
          Standort außerhalb der EU bzw. des EWR stellt der Betreiber geeignete
          Garantien nach Art. 44 ff. DSGVO sicher.
        </p>
      </LegalSection>

      <LegalSection id="links" number={12} title="Externe Links">
        <p>
          Diese Website verlinkt auf externe Seiten, insbesondere auf unseren
          Partnerverein {partner.name} (
          <a href={partner.url} target="_blank" rel="noopener noreferrer">
            {partner.domain}
          </a>
          ). Beim bloßen Anzeigen unserer Seiten werden keine Daten an diese
          Seiten übermittelt. Erst wenn du einem Link folgst, gelten die
          Datenschutzbestimmungen des jeweiligen Betreibers; auf diese haben wir
          keinen Einfluss.
        </p>
      </LegalSection>

      <LegalSection id="rechte" number={13} title="Deine Rechte">
        <p>Dir stehen nach der DSGVO folgende Rechte zu:</p>
        <ul>
          <li>
            Auskunft über die zu deiner Person gespeicherten Daten (Art. 15
            DSGVO)
          </li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>Löschung deiner Daten (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>
            Widerspruch gegen Verarbeitungen auf Grundlage berechtigter
            Interessen (Art. 21 DSGVO)
          </li>
        </ul>
        <p>
          Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die
          Zukunft widerrufen (Art. 7 Abs. 3 DSGVO). Die Rechtmäßigkeit der bis
          dahin erfolgten Verarbeitung bleibt davon unberührt. Die Einwilligung
          in den Newsletter widerrufst du am einfachsten über den Abmelde-Link
          in jeder Newsletter-E-Mail (Abschnitt 7).
        </p>
        <p>
          Zur Ausübung deiner Rechte genügt eine Nachricht an die unter
          Abschnitt 1 genannte E-Mail-Adresse oder über das{" "}
          <Link href="/contact">Kontaktformular</Link>. Zudem hast du das Recht,
          dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77
          DSGVO), insbesondere in dem Mitgliedstaat deines gewöhnlichen
          Aufenthaltsorts, deines Arbeitsplatzes oder des Orts des mutmaßlichen
          Verstoßes.
        </p>
      </LegalSection>

      <LegalSection id="sicherheit" number={14} title="Datensicherheit">
        <p>
          Die Übertragung zwischen deinem Browser und unseren Servern erfolgt
          verschlüsselt per TLS (erkennbar am Schloss-Symbol bzw. an „https“).
          Passwörter werden ausschließlich als Hash gespeichert, Einmal-Links
          für Bestätigung (auch die Bestätigung der Newsletter-Anmeldung) und
          Passwort-Reset ebenfalls. Der Zugriff auf gespeicherte Anfragen,
          Konten und Newsletter-Anmeldungen ist auf berechtigte Personen
          beschränkt. Wir passen unsere technischen und organisatorischen
          Maßnahmen fortlaufend an den Stand der Technik an.
        </p>
      </LegalSection>

      <LegalSection
        id="aenderungen"
        number={15}
        title="Änderungen dieser Erklärung"
      >
        <p>
          Wir passen diese Datenschutzerklärung an, wenn sich die Website,
          unsere Dienste oder die Rechtslage ändern. Es gilt jeweils die hier
          veröffentlichte Fassung.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
