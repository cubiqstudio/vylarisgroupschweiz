import Link from "next/link";
import {
  LegalPage,
  LegalSection,
  type TocItem,
} from "@/components/legal/legal-page";
import { EmailValue, ProviderAddress } from "@/components/legal/provider-block";
import { STORAGE_KEY } from "@/components/consent/consent-config";
import { legalUi } from "@/i18n/legal";
import { getMessages, getSite } from "@/i18n/server";
import { formatPrivacyUpdatedAt, getLegal } from "@/lib/legal";
import { SESSION_COOKIE } from "@/lib/session";

/** Schlüssel der Hell-/Dunkel-Wahl im lokalen Speicher (siehe src/components/theme/theme-switch.tsx). */
const THEME_KEY = "vgs-theme";

const toc: TocItem[] = [
  { id: "verantwortlicher", title: "Verantwortlicher" },
  { id: "ueberblick", title: "Überblick" },
  { id: "hosting", title: "Hosting und Server-Logfiles" },
  { id: "kontakt", title: "Kontaktformular und Ticket-System" },
  { id: "konto", title: "Nutzerkonto" },
  { id: "lizenzen", title: "Lizenzschlüssel und Webspace-Anfragen" },
  { id: "mail", title: "E-Mail-Versand" },
  { id: "newsletter", title: "Newsletter" },
  { id: "cookies", title: "Cookies und lokaler Speicher" },
  { id: "missbrauchsschutz", title: "Missbrauchsschutz" },
  { id: "empfaenger", title: "Empfänger" },
  { id: "ausland", title: "Bekanntgabe ins Ausland" },
  { id: "aufbewahrung", title: "Aufbewahrung und Löschung" },
  { id: "links", title: "Externe Links" },
  { id: "rechte", title: "Deine Rechte" },
  { id: "sicherheit", title: "Datensicherheit" },
  { id: "aenderungen", title: "Änderungen dieser Erklärung" },
];

/**
 * Datenschutzerklärung nach dem Schweizer Datenschutzgesetz (revDSG): Verantwortlicher aus den Admin-Einstellungen.
 * Die Beschreibung der Datenbearbeitung muss zum Verhalten der Software passen – bei Änderungen am Code hier nachziehen
 * und das Stand-Datum (PRIVACY_UPDATED_AT in src/lib/legal.ts) erneuern.
 */
export async function Datenschutz() {
  const legal = await getLegal();
  const site = await getSite();
  const ui = await getMessages(legalUi);
  const stand = ui.privacy.standLabel(formatPrivacyUpdatedAt());

  return (
    <LegalPage
      eyebrow={ui.eyebrow}
      title={ui.privacy.title}
      description="Transparent und knapp: Hier steht, welche Personendaten diese Website bearbeitet – und welche ausdrücklich nicht."
      toc={toc}
      notice={<p className="text-sm text-zinc-400">{stand}</p>}
    >
      <LegalSection id="verantwortlicher" number={1} title="Verantwortlicher">
        <p>
          Verantwortlich für die Datenbearbeitung auf dieser Website im Sinne
          des Schweizer Datenschutzgesetzes (DSG) ist:
        </p>
        <ProviderAddress legal={legal} name={site.legalName} />
        <p>
          Der Verein wird durch den Vorstand vertreten
          {site.board.length > 0 && (
            <> ({site.board.map((m) => m.name).join(", ")})</>
          )}
          .
          <br />
          E-Mail (auch für Datenschutzanfragen): <EmailValue email={legal.email} />
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
      </LegalSection>

      <LegalSection id="ueberblick" number={2} title="Überblick">
        <p>
          Wir halten die Bearbeitung von Personendaten so gering wie möglich.
          Beim reinen Besuch dieser Website gilt:
        </p>
        <ul>
          <li>
            Wir setzen keine Tracking- oder Analyse-Werkzeuge ein und erstellen
            keine Nutzungsprofile.
          </li>
          <li>
            Wir binden keine externen Schriftarten, Content-Delivery-Netzwerke,
            Skripte oder Werbedienste ein. Alle Ressourcen der Seiten werden
            von unseren eigenen Servern ausgeliefert.
          </li>
          <li>
            Besucherinnen und Besucher ohne Anmeldung erhalten keine Cookies.
            Ein Cookie wird erst nach einer Anmeldung gesetzt (siehe Abschnitt
            9).
          </li>
          <li>
            Wir messen nicht, ob und wie du unsere E-Mails öffnest oder darin
            klickst; es gibt keine Tracking-Pixel (siehe Abschnitt 8).
          </li>
        </ul>
        <p>
          Personendaten bearbeiten wir nur, soweit dies technisch erforderlich
          ist (Abschnitt 3), du uns über das Kontaktformular kontaktierst
          (Abschnitt 4), du ein Nutzerkonto anlegst und verwendest (Abschnitte
          5 bis 7) oder du dich für den Newsletter anmeldest (Abschnitt 8). Die
          Bearbeitung erfolgt nach den Grundsätzen des DSG, insbesondere nach
          Treu und Glauben, verhältnismässig und zweckgebunden.
        </p>
      </LegalSection>

      <LegalSection id="hosting" number={3} title="Hosting und Server-Logfiles">
        <p>
          Diese Website wird von uns selbst betrieben, auf Servern, die wir
          selbst verantworten. Beim Aufruf einzelner Seiten übermittelt dein
          Browser technisch notwendige Verbindungsdaten, etwa deine
          IP-Adresse, Datum und Uhrzeit der Anfrage, die angeforderte Adresse,
          den Antwortstatus sowie Angaben zu Browser und Betriebssystem.
        </p>
        <p>
          Diese Daten werden bearbeitet, um die Seiten auszuliefern, die
          Stabilität und Sicherheit des Betriebs zu gewährleisten und Angriffe
          abzuwehren. Wir werten sie nicht aus, führen sie nicht mit anderen
          Datenquellen zusammen und bewahren sie nur so lange auf, wie es für
          den sicheren Betrieb nötig ist. Unser Interesse liegt im sicheren
          und störungsfreien Betrieb des Angebots.
        </p>
        <p>
          Je nach Betriebsart kann der Datenverkehr über einen vorgeschalteten
          Tunnel- oder Proxy-Dienst zu unseren Servern geleitet werden (etwa
          einen Cloudflare Tunnel). Ein solcher Dienst leitet die Verbindung
          technisch weiter und sieht dabei die für die Weiterleitung nötigen
          Verbindungsdaten.
        </p>
      </LegalSection>

      <LegalSection
        id="kontakt"
        number={4}
        title="Kontaktformular und Ticket-System"
      >
        <p>
          Wenn du uns über das <Link href="/contact">Kontaktformular</Link>{" "}
          schreibst, legen wir aus deinen Angaben ein Ticket an. Dabei
          speichern wir:
        </p>
        <ul>
          <li>Name und E-Mail-Adresse</li>
          <li>Betreff, gewählte Kategorie und Nachricht</li>
          <li>
            die automatisch vergebene Ticketnummer, die Sprache der Anfrage
            sowie Zeitstempel und Bearbeitungsstatus
          </li>
        </ul>
        <p>
          Zusätzlich können wir interne Notizen zur Bearbeitung des Tickets
          hinterlegen. Diese Notizen sind für dich nicht sichtbar. Antworten,
          die wir dir zu einem Ticket schicken, speichern wir am Ticket: den
          Text der Antwort, den Namen der antwortenden Person, den Zeitpunkt
          sowie den Vermerk, ob der E-Mail-Versand erfolgreich war (bei einem
          Fehler zusätzlich die technische Fehlermeldung des Mailservers).
          Ein Ticket kann einem Teammitglied zur Bearbeitung zugewiesen
          werden.
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
          Ausserdem kann bei einem neuen Ticket eine interne Hinweis-E-Mail an
          eine vom Betreiber hinterlegte Adresse des Teams gesendet werden. Sie
          enthält die Angaben zum neuen Ticket und dient allein dazu, dass die
          Anfrage zeitnah bearbeitet wird. Der Versand erfolgt über den in
          Abschnitt 7 beschriebenen SMTP-Server.
        </p>
        <h3>Zweck und Grundlage</h3>
        <p>
          Wir bearbeiten die Daten, um deine Anfrage zu beantworten und zu
          bearbeiten. Die Bearbeitung erfolgt auf Grundlage deiner
          Einwilligung, die du durch das Setzen der Einwilligungs-Checkbox im
          Formular erteilst. Die E-Mails zum Ticket (Eingangsbestätigung,
          Statusinformationen und Antworten) dienen der Durchführung deiner
          Anfrage; die interne Hinweis-E-Mail an das Team und die Bearbeitung
          von Sicherheitsmeldungen beruhen auf unserem Interesse an einer
          ordnungsgemässen und zeitnahen Bearbeitung.
        </p>
        <p>
          Die Angabe der Daten ist freiwillig. Ohne die Pflichtfelder können
          wir dein Anliegen allerdings nicht bearbeiten. Deine Einwilligung
          kannst du jederzeit mit Wirkung für die Zukunft widerrufen (siehe
          Abschnitt 15).
        </p>
      </LegalSection>

      <LegalSection id="konto" number={5} title="Nutzerkonto">
        <p>
          Du kannst auf dieser Website ein Nutzerkonto anlegen, sofern der
          Betreiber die Registrierung aktiviert hat. Die Registrierung ist
          freiwillig; alle öffentlichen Inhalte kannst du auch ohne Konto
          nutzen.
        </p>
        <h3>Bearbeitete Daten</h3>
        <ul>
          <li>Name und E-Mail-Adresse, die du bei der Registrierung angibst</li>
          <li>
            dein Passwort ausschliesslich als gesalzener bcrypt-Hash; im
            Klartext wird es zu keinem Zeitpunkt gespeichert
          </li>
          <li>
            Zeitstempel der Registrierung, der Bestätigung deiner E-Mail-Adresse
            und deiner letzten Anmeldung sowie die Sprache zum Zeitpunkt der
            Registrierung
          </li>
          <li>
            Einmal-Links für die E-Mail-Bestätigung und das Zurücksetzen des
            Passworts, die wir nur als Hash speichern; sie sind 48 Stunden
            (Bestätigung) bzw. 1 Stunde (Passwort-Reset) gültig
          </li>
        </ul>
        <h3>Firmenkunden-Status</h3>
        <p>
          Wenn du im Konto den Status als Firmenkunde beantragst, speichern wir
          zusätzlich den angegebenen Firmennamen und den Stand deines Antrags
          (ausstehend, freigegeben oder abgelehnt). Das Team entscheidet über
          den Antrag.
        </p>
        <h3>Teammitglieder</h3>
        <p>
          Für Mitglieder des Teams, denen der Verein einen Team-Bereich
          freigeschaltet hat, speichern wir zusätzlich die vergebene Bezeichnung
          im Team und, wenn die Person es hochlädt, ein Profilbild. Das
          Profilbild wird bei Antworten auf Tickets angezeigt.
        </p>
        <h3>Zweck und Grundlage</h3>
        <p>
          Wir bearbeiten diese Daten, um dein Konto einzurichten und zu führen,
          deine E-Mail-Adresse zu bestätigen, dich anzumelden und dir bei
          Bedarf den Zugang zurückzusetzen. Grundlage ist das Nutzungsverhältnis
          zum Konto, das du mit der Registrierung eingehst.
        </p>
        <h3>Aufbewahrung und Löschung</h3>
        <p>
          Wir speichern die Kontodaten bis zur Löschung deines Kontos. Du kannst
          dein Konto jederzeit selbst unter «Konto» löschen. Dabei werden auch
          die zugehörigen Einmal-Links, Lizenzschlüssel und Webspace-Anfragen
          gelöscht. Tickets, die du über das Kontaktformular gesendet hast, sind
          nicht mit dem Konto verknüpft und bleiben davon unberührt (siehe
          Abschnitt 13). Gesetzliche Aufbewahrungspflichten bleiben
          vorbehalten.
        </p>
      </LegalSection>

      <LegalSection
        id="lizenzen"
        number={6}
        title="Lizenzschlüssel und Webspace-Anfragen"
      >
        <p>
          Im Nutzerkonto kannst du, je nach Angebot, Lizenzschlüssel für
          unsere Produkte beantragen und eine Anfrage für Webspace stellen.
        </p>
        <h3>Bearbeitete Daten</h3>
        <ul>
          <li>
            Lizenzschlüssel: Der Schlüssel liegt nicht im Klartext in der
            Datenbank, sondern als Prüfwert und verschlüsselt, damit du ihn in
            deinem Konto wiedersehen kannst. Dazu kommen das Produkt, der
            Status, dein Wunsch bzw. Verwendungszweck, ein allfälliger Hinweis
            des Teams sowie Zeitpunkte der Beantragung und Entscheidung.
          </li>
          <li>
            Prüfung des Schlüssels: Programme, die einen Schlüssel prüfen
            (etwa ein Installer), übermitteln den Schlüssel und eine
            Kennung der Installation, zum Beispiel die Domain. Beim ersten
            Prüfen wird der Schlüssel an diese Installation gebunden. Wir
            speichern die Kennung, den Zeitpunkt der Bindung, den Zeitpunkt der
            letzten Prüfung und die Zahl der Prüfungen.
          </li>
          <li>
            Webspace-Anfrage: dein Wunsch bzw. Verwendungszweck, der Status
            der Anfrage und ein allfälliger Hinweis des Teams.
          </li>
        </ul>
        <h3>Zweck und Grundlage</h3>
        <p>
          Wir bearbeiten diese Daten, um Schlüssel auszustellen und zu
          prüfen, Missbrauch (etwa die Weitergabe eines Schlüssels an fremde
          Installationen) zu verhindern und deine Anfragen zu beantworten.
          Grundlage ist das Nutzungsverhältnis zum Konto und deine Anfrage.
          Die Daten werden mit dem Konto gelöscht (Abschnitt 5).
        </p>
      </LegalSection>

      <LegalSection id="mail" number={7} title="E-Mail-Versand">
        <p>
          Wir versenden E-Mails im Zusammenhang mit dem Nutzerkonto
          (Bestätigungs-E-Mails bei der Registrierung, E-Mails zum Zurücksetzen
          des Passworts und Informations-E-Mails zu deinem Konto), zu Tickets
          (siehe Abschnitt 4) und, wenn du dich angemeldet hast, den Newsletter
          (siehe Abschnitt 8). Dabei werden deine E-Mail-Adresse,
          gegebenenfalls dein Name sowie der jeweilige Nachrichteninhalt (etwa
          ein Bestätigungs- oder Rücksetz-Link) bearbeitet.
        </p>
        <p>
          Der Versand erfolgt über den SMTP-Server, den der Betreiber dieser
          Website eingerichtet hat, das heisst über einen eigenen Mailserver
          oder den E-Mail-Anbieter des Betreibers. Eine Weitergabe der Daten an
          weitere Dritte durch uns findet dabei nicht statt. Für den Newsletter
          gilt zusätzlich Abschnitt 8.
        </p>
      </LegalSection>

      <LegalSection id="newsletter" number={8} title="Newsletter">
        <p>
          Wenn der Newsletter auf dieser Website aktiviert ist, kannst du dich
          dafür anmelden. Die Anmeldung ist freiwillig; alle Inhalte und
          Funktionen der Website kannst du auch ohne Newsletter nutzen.
        </p>
        <h3>Zweck und Grundlage</h3>
        <p>
          Wir verwenden deine Daten, um dir per E-Mail Neuigkeiten zu unseren
          Angeboten und zur Website zuzusenden. Grundlage ist deine
          Einwilligung, die du mit der Anmeldung und der Bestätigung deiner
          E-Mail-Adresse erteilst.
        </p>
        <h3>Anmeldung im Double-Opt-in-Verfahren</h3>
        <p>
          Nach der Anmeldung senden wir dir eine E-Mail mit einem
          Bestätigungslink. Erst wenn du diesen Link aufrufst und die
          Bestätigung auf der Seite auslöst, ist deine Anmeldung wirksam und
          du erhältst den Newsletter. So stellen wir
          sicher, dass niemand fremde Adressen einträgt. Der Bestätigungslink
          ist nur begrenzt gültig; eine nicht bestätigte Anmeldung wird nach
          Ablauf des Links nicht weiter genutzt, und es werden keine Newsletter
          an diese Adresse gesendet.
        </p>
        <h3>Gespeicherte Daten</h3>
        <ul>
          <li>
            deine E-Mail-Adresse und, wenn du ihn angibst, dein Name
            (freiwillig) sowie die Sprache der Anmeldung
          </li>
          <li>
            der Zeitpunkt deiner Einwilligung (Anmeldung) und der Zeitpunkt der
            Bestätigung, als Nachweis der Einwilligung
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
          dieser Website eingerichtet hat (siehe Abschnitt 7). Eine Weitergabe
          an weitere Dritte findet nicht statt.
        </p>
        <h3>Widerruf und Abmeldung</h3>
        <p>
          Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft
          widerrufen. Jede Newsletter-E-Mail enthält dazu einen Abmelde-Link,
          über den du dich mit einem Klick abmelden kannst. Darüber hinaus
          unterstützen wir die Abmeldefunktion deines E-Mail-Programms
          (One-Click-Abmeldung über den Header «List-Unsubscribe»). Alternativ
          genügt eine Nachricht an die unter Abschnitt 1 genannte
          E-Mail-Adresse. Die Rechtmässigkeit der bis zum Widerruf erfolgten
          Bearbeitung bleibt unberührt.
        </p>
        <h3>Aufbewahrung</h3>
        <p>
          Wir speichern deine Daten, bis du deine Einwilligung widerrufst. Nach
          der Abmeldung führen wir deine E-Mail-Adresse als abgemeldet weiter,
          damit dir nicht versehentlich erneut Newsletter zugesendet werden und
          dein Widerruf nachweisbar bleibt. Möchtest du, dass wir deine Daten
          vollständig löschen, teile uns das mit (Abschnitt 15); wir löschen
          sie dann, soweit keine gesetzlichen Aufbewahrungspflichten
          entgegenstehen. Bitte beachte, dass damit auch der Schutz vor einer
          erneuten Zusendung entfällt.
        </p>
      </LegalSection>

      <LegalSection
        id="cookies"
        number={9}
        title="Cookies und lokaler Speicher"
      >
        <p>
          Besucherinnen und Besucher ohne Anmeldung erhalten keine Cookies. Nach
          einer erfolgreichen Anmeldung setzen wir den technisch notwendigen
          Cookie <code>{SESSION_COOKIE}</code>.
        </p>
        <ul>
          <li>
            Er ist als <code>httpOnly</code> gekennzeichnet, für JavaScript also
            nicht auslesbar, und mit <code>SameSite=Lax</code> sowie{" "}
            <code>Secure</code> (nur über verschlüsselte Verbindungen) versehen.
          </li>
          <li>
            Er enthält ausschliesslich ein signiertes Sitzungstoken mit
            Konto-Kennung, Name, E-Mail-Adresse und Rolle.
          </li>
          <li>
            Seine Laufzeit beträgt höchstens 14 Tage (bei der Anmeldung des
            Teams im Verwaltungsbereich 8 Stunden). Beim Abmelden wird er
            entfernt.
          </li>
        </ul>
        <p>
          Der Cookie ist unbedingt erforderlich, damit der von dir ausdrücklich
          angeforderte Dienst, nämlich die Anmeldung, bereitgestellt werden
          kann. Mit dieser Erklärung und dem Cookie-Hinweis informieren wir dich
          über Cookies und ihren Zweck (Art. 45c des Fernmeldegesetzes); weil
          nur dieser notwendige Cookie zum Einsatz kommt, gibt es nichts
          abzulehnen.
        </p>
        <h3>Cookie-Hinweis und Einstellungen</h3>
        <p>
          Beim Besuch der Website blenden wir einen Cookie-Hinweis ein, in dem
          du dich über die eingesetzten Cookies informieren und deine
          Einstellungen vornehmen kannst. Derzeit setzen wir ausschliesslich den
          oben genannten, technisch notwendigen Cookie ein; Analyse- und
          Marketing-Cookies kommen nicht zum Einsatz. Würden wir künftig
          optionale Kategorien einführen, würden wir sie nur mit deiner
          vorherigen Einwilligung aktivieren.
        </p>
        <h3>Lokaler Speicher im Browser</h3>
        <p>
          Zwei Einträge speichern wir ausschliesslich lokal in deinem Browser
          (Local Storage); es sind keine Cookies, und sie werden nicht an uns
          oder an Dritte übertragen:
        </p>
        <ul>
          <li>
            <code>{STORAGE_KEY}</code>: deine Auswahl im Cookie-Hinweis, damit
            wir dich nicht bei jedem Besuch erneut fragen.
          </li>
          <li>
            <code>{THEME_KEY}</code>: deine Wahl der Darstellung (hell, dunkel
            oder System), wenn du sie im Footer oder im Profil-Menü änderst.
          </li>
        </ul>
        <p>
          Du kannst die Einträge jederzeit in den Einstellungen deines Browsers
          löschen; dann wird der Cookie-Hinweis wieder angezeigt bzw. die
          Darstellung folgt wieder deinem System. Deine Cookie-Einstellungen
          kannst du jederzeit ändern: Über den Link «Cookie-Einstellungen» im
          Footer der Website öffnest du den Einstellungs-Dialog erneut.
        </p>
      </LegalSection>

      <LegalSection id="missbrauchsschutz" number={10} title="Missbrauchsschutz">
        <p>
          Um das Kontaktformular sowie Anmeldung, Registrierung und
          Passwort-Reset vor automatisiertem Missbrauch zu schützen, begrenzen
          wir die Zahl der Anfragen pro Zeitraum. Dafür wird deine IP-Adresse
          (bei Anmeldung und Registrierung teilweise zusätzlich in Verbindung
          mit der eingegebenen E-Mail-Adresse) flüchtig im Arbeitsspeicher des
          Servers bearbeitet. Sie wird nicht dauerhaft gespeichert und nicht in
          der Datenbank abgelegt; nach Ablauf des Zeitfensters oder einem
          Neustart des Dienstes ist sie nicht mehr vorhanden.
        </p>
        <p>
          Zusätzlich enthält das Kontaktformular ein für Menschen unsichtbares
          Feld (Honeypot). Es dient allein dazu, automatisierte Einsendungen zu
          erkennen, und erhebt keine Personendaten. Unser Interesse liegt im
          Schutz vor Missbrauch und in der Sicherung des Betriebs.
        </p>
      </LegalSection>

      <LegalSection id="empfaenger" number={11} title="Empfänger">
        <p>
          Deine Daten werden auf unseren eigenen Servern bearbeitet. Eine
          Weitergabe an Dritte findet nicht statt, es sei denn, wir sind dazu
          gesetzlich verpflichtet. Ausnahmen bilden der E-Mail-Versand über
          den vom Betreiber konfigurierten SMTP-Server (Abschnitt 7); über ihn
          laufen auch die Mails zu Tickets (Abschnitt 4) und der Newsletter
          (Abschnitt 8). Bei Betrieb über einen Tunnel- oder Proxy-Dienst
          (z. B. Cloudflare) ist dieser Dienst Empfänger der
          Verbindungsdaten (Abschnitt 3). Intern erhalten nur diejenigen Mitglieder des Teams
          Zugriff, die Anfragen, Konten und Newsletter-Anmeldungen verwalten,
          Mitteilungen versenden oder den Betrieb sicherstellen.
        </p>
      </LegalSection>

      <LegalSection id="ausland" number={12} title="Bekanntgabe ins Ausland">
        <p>
          Bei Nutzung eines Tunnel- oder Proxy-Dienstes (Abschnitt 3) können
          Verbindungsdaten (IP-Adresse, aufgerufene Seite, Zeitpunkt) in
          Länder ausserhalb der Schweiz gelangen, auch in Länder ohne
          angemessenen Datenschutz. Wir stellen den Schutz durch geeignete
          Garantien sicher (z. B. Standardvertragsklauseln, Art. 16 Abs. 2
          DSG). Darüber hinaus gibt diese Website von sich aus keine
          Personendaten ins Ausland bekannt. Für den E-Mail-Versand ist der
          Standort des vom Betreiber eingesetzten Mailservers massgeblich;
          befindet er sich in einem Land ohne angemessenen Datenschutz,
          stellt der Betreiber durch geeignete Garantien einen angemessenen
          Schutz sicher (Art. 16 DSG).
        </p>
      </LegalSection>

      <LegalSection id="aufbewahrung" number={13} title="Aufbewahrung und Löschung">
        <p>
          Wir bewahren Personendaten nur so lange auf, wie es für den jeweiligen
          Zweck nötig ist oder eine gesetzliche Pflicht es verlangt:
        </p>
        <ul>
          <li>
            Tickets und Antworten: so lange, wie es zur Bearbeitung deiner
            Anfrage erforderlich ist, und, soweit gesetzliche
            Aufbewahrungspflichten bestehen, für die Dauer dieser Fristen.
            Danach löschen wir sie von Hand; auf Anfrage geschieht das
            jederzeit.
          </li>
          <li>
            Nutzerkonto samt Lizenzschlüsseln und Webspace-Anfragen: bis zur
            Löschung des Kontos, die du selbst vornehmen kannst.
          </li>
          <li>
            Einmal-Links für E-Mail-Bestätigung und Passwort-Reset: nur als
            Hash und nur bis zum Ablauf der Gültigkeit bzw. bis zur Verwendung
            von Bedeutung.
          </li>
          <li>
            Newsletter-Anmeldung: bis zum Widerruf, danach nur als
            «abgemeldet» geführt (Abschnitt 8).
          </li>
          <li>
            IP-Adresse zum Missbrauchsschutz: flüchtig im Arbeitsspeicher
            (Abschnitt 10).
          </li>
        </ul>
        <p>
          Möchtest du, dass wir Daten vorzeitig löschen, schreib uns an die
          unter Abschnitt 1 genannte Adresse (Abschnitt 15).
        </p>
      </LegalSection>

      <LegalSection id="links" number={14} title="Externe Links">
        <p>
          Diese Website verlinkt auf externe Seiten, etwa auf andere Standorte
          der VylarisGroup, auf unsere Kanäle bei X, YouTube, Instagram und
          Discord, auf WhatsApp als Kontaktweg oder auf Quellen im Web. Beim blossen Anzeigen unserer Seiten
          werden keine Daten an diese Seiten übermittelt. Erst wenn du einem
          Link folgst, gelten die Datenschutzbestimmungen des jeweiligen
          Betreibers; auf diese haben wir keinen Einfluss.
        </p>
      </LegalSection>

      <LegalSection id="rechte" number={15} title="Deine Rechte">
        <p>Dir stehen nach dem DSG insbesondere folgende Rechte zu:</p>
        <ul>
          <li>
            Auskunft darüber, ob und welche Personendaten wir von dir
            bearbeiten (Art. 25 DSG)
          </li>
          <li>
            Herausgabe oder Übertragung deiner Daten in einem gängigen
            elektronischen Format (Art. 28 DSG)
          </li>
          <li>
            Berichtigung unrichtiger Daten sowie Löschung, Sperrung oder
            Widerspruch gegen die Bearbeitung (Art. 32 DSG)
          </li>
        </ul>
        <p>
          Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die
          Zukunft widerrufen. Die Rechtmässigkeit der bis dahin erfolgten
          Bearbeitung bleibt davon unberührt. Die Einwilligung in den Newsletter
          widerrufst du am einfachsten über den Abmelde-Link in jeder
          Newsletter-E-Mail (Abschnitt 8).
        </p>
        <p>
          Zur Ausübung deiner Rechte genügt eine Nachricht an die unter
          Abschnitt 1 genannte E-Mail-Adresse oder über das{" "}
          <Link href="/contact">Kontaktformular</Link>. Zum Schutz deiner Daten
          können wir einen Nachweis deiner Identität verlangen. Auskunftsbegehren
          beantworten wir in der Regel innert 30 Tagen.
        </p>
        <p>
          Du kannst dich ausserdem an den Eidgenössischen Datenschutz- und
          Öffentlichkeitsbeauftragten (EDÖB) wenden und bei ihm Anzeige
          erstatten, wenn du der Ansicht bist, dass wir Personendaten
          rechtswidrig bearbeiten:{" "}
          <a
            href="https://www.edoeb.admin.ch"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.edoeb.admin.ch
          </a>
          . Wir freuen uns, wenn du dich vorher bei uns meldest; wir suchen
          gerne gemeinsam eine Lösung.
        </p>
      </LegalSection>

      <LegalSection id="sicherheit" number={16} title="Datensicherheit">
        <p>
          Die Übertragung zwischen deinem Browser und unseren Servern erfolgt
          verschlüsselt per TLS (erkennbar am Schloss-Symbol bzw. an «https»).
          Passwörter werden ausschliesslich als Hash gespeichert, Einmal-Links
          für Bestätigung (auch die Bestätigung der Newsletter-Anmeldung) und
          Passwort-Reset ebenfalls. Lizenzschlüssel und vertrauliche
          Einstellungen (etwa Zugangsdaten zum Mailserver) liegen nur
          verschlüsselt in der Datenbank. Der Zugriff auf gespeicherte
          Anfragen, Konten und Newsletter-Anmeldungen ist auf berechtigte
          Personen beschränkt. Wir passen unsere technischen und
          organisatorischen Massnahmen fortlaufend an den Stand der Technik an.
        </p>
      </LegalSection>

      <LegalSection
        id="aenderungen"
        number={17}
        title="Änderungen dieser Erklärung"
      >
        <p>
          Wir passen diese Datenschutzerklärung an, wenn sich die Website,
          unsere Dienste oder die Rechtslage ändern. Es gilt jeweils die hier
          veröffentlichte Fassung. {stand}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
