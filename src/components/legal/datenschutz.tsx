import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { EmailValue, ProviderAddress } from "@/components/legal/provider-block";
import { STORAGE_KEY } from "@/components/consent/consent-config";
import { legalUi } from "@/i18n/legal";
import { getMessages, getSite } from "@/i18n/server";
import { formatPrivacyUpdatedAt, getLegal } from "@/lib/legal";
import { formatSectionRefs, privacyPlan } from "@/lib/legal-toggles";
import { SESSION_COOKIE } from "@/lib/session";
import { GUEST_RETENTION_DAYS } from "@/lib/verein/events-lib";

/** Schlüssel der Hell-/Dunkel-Wahl im lokalen Speicher (siehe src/components/theme/theme-switch.tsx). */
const THEME_KEY = "vgs-theme";

/** «a, b oder c» (conjunction = " und ": «a, b und c») für eine Aufzählung in einem Satz. */
function joinList(items: ReactNode[], conjunction = " oder "): ReactNode {
  return items.map((item, i) => (
    <Fragment key={i}>
      {i > 0 && (i === items.length - 1 ? conjunction : ", ")}
      {item}
    </Fragment>
  ));
}

/**
 * Datenschutzerklärung nach dem Schweizer Datenschutzgesetz (revDSG): Verantwortlicher aus den Admin-Einstellungen.
 * Die Abschnitte zu einzelnen Funktionen erscheinen nur, wenn sie in «Einstellungen → Rechtliches» eingeschaltet sind;
 * Nummerierung, Inhaltsverzeichnis und Querverweise («Abschnitt 8») folgen den sichtbaren Abschnitten.
 * Die Beschreibung der Datenbearbeitung muss zum Verhalten der Software passen – bei Änderungen am Code hier nachziehen
 * und das Stand-Datum erneuern (wird beim Speichern der Einstellungen automatisch nachgeführt, Fallback PRIVACY_UPDATED_AT
 * in src/lib/legal.ts).
 */
export async function Datenschutz() {
  const legal = await getLegal();
  const site = await getSite();
  const ui = await getMessages(legalUi);
  const stand = ui.privacy.standLabel(formatPrivacyUpdatedAt(legal.privacyUpdatedAt));

  const plan = privacyPlan(legal.privacy);
  const has = plan.has;
  const titleOf = (id: string) => plan.sections.find((s) => s.id === id)?.title ?? "";
  /** «Abschnitt 4» bzw. leer, wenn der Abschnitt nicht in der Erklärung steht. */
  const sec = (...ids: string[]) => formatSectionRefs(ids.map((id) => plan.numberOf(id)));
  /** « (Abschnitt 4)» bzw. leer. */
  const paren = (...ids: string[]) => (sec(...ids) ? ` (${sec(...ids)})` : "");
  /** « (siehe Abschnitt 4)» bzw. leer. */
  const siehe = (...ids: string[]) => (sec(...ids) ? ` (siehe ${sec(...ids)})` : "");

  const Sec = ({ id, children }: { id: string; children: ReactNode }) => (
    <LegalSection id={id} number={plan.numberOf(id) ?? 0} title={titleOf(id)}>
      {children}
    </LegalSection>
  );

  const anyVerein = has("mitglieder") || has("beitraege") || has("versammlungen") || has("anlaesse");
  const rights = (extra?: ReactNode) => (
    <>
      <h3>Deine Rechte</h3>
      <p>
        Es gelten die Rechte nach {sec("rechte")} (Auskunft, Berichtigung, Löschung, Herausgabe).
        {extra && <> {extra}</>}
      </p>
    </>
  );

  const purposes = [
    <>wenn dies technisch erforderlich ist{paren("hosting")}</>,
    has("kontakt") && <>wenn du uns über das Kontaktformular kontaktierst{paren("kontakt")}</>,
    has("konto") && <>wenn du ein Nutzerkonto anlegst und verwendest{paren("konto", "lizenzen", "mail")}</>,
    has("newsletter") && <>wenn du dich für den Newsletter anmeldest{paren("newsletter")}</>,
    has("mitglieder") && <>wenn du dich als Mitglied bewirbst oder Mitglied bist{paren("mitglieder", "ausweis", "tuerkontrolle", "beitraege", "versammlungen")}</>,
    has("anlaesse") && <>wenn du dich für einen Anlass anmeldest{paren("anlaesse")}</>,
  ].filter(Boolean) as ReactNode[];

  const mailUses = [
    has("konto") &&
      "dem Nutzerkonto (Bestätigungs-E-Mails bei der Registrierung, E-Mails zum Zurücksetzen des Passworts und Informations-E-Mails zu deinem Konto)",
    has("kontakt") && `deinen Anfragen und Tickets${siehe("kontakt")}`,
    has("newsletter") && `dem Newsletter, wenn du dich angemeldet hast${siehe("newsletter")}`,
    anyVerein &&
      `der Vereinsverwaltung (Bestätigungen zum Beitritt, Rechnungen und Mahnungen, Einladungen zu Versammlungen, Bestätigungen zu Anlässen)${siehe("mitglieder", "beitraege", "versammlungen", "anlaesse")}`,
  ].filter(Boolean) as string[];

  const anyRetention = (["kontakt", "konto", "lizenzen", "newsletter", "missbrauchsschutz", "mitglieder", "beitraege", "versammlungen", "anlaesse", "dokumente", "audit"] as const).some((k) => has(k));
  const webData = [has("kontakt") && "Anfragen", has("konto") && "Konten", has("newsletter") && "Newsletter-Anmeldungen"].filter(Boolean) as string[];
  const protectedData = [...webData, anyVerein && "Mitglieder-, Rechnungs- und Buchungsdaten"].filter(Boolean) as string[];

  // Interne Links auf abgeschaltete Abschnitte (z. B. #newsletter aus dem Anmeldeformular, #cookies aus dem Cookie-Hinweis)
  // laufen nicht ins Leere: Der Anker bleibt als leere Marke am Anfang der Erklärung bestehen, der Link führt dann an den Anfang.
  const notice = (
    <>
      <p className="text-sm text-zinc-400">{stand}</p>
      {plan.disabledAnchors.map((id) => (
        <span key={id} id={id} aria-hidden />
      ))}
    </>
  );

  return (
    <LegalPage
      eyebrow={ui.eyebrow}
      title={ui.privacy.title}
      description="Transparent und knapp: Hier steht, welche Personendaten diese Website bearbeitet – und welche ausdrücklich nicht."
      toc={plan.sections.map(({ id, title }) => ({ id, title }))}
      notice={notice}
    >
      <Sec id="verantwortlicher">
        <p>
          Verantwortlich für die Datenbearbeitung auf dieser Website im Sinne des Schweizer Datenschutzgesetzes (DSG) ist:
        </p>
        <ProviderAddress legal={legal} name={site.legalName} markMissing />
        <p>
          Der Verein wird durch den Vorstand vertreten
          {site.board.length > 0 && <> ({site.board.map((m) => m.name).join(", ")})</>}
          .
          <br />
          E-Mail (auch für Datenschutzanfragen): <EmailValue email={legal.email} />
          {legal.imprint.phone && (
            <>
              <br />
              Telefon: {legal.phone}
            </>
          )}
        </p>
        <p>
          Weitere Angaben zum Anbieter findest du im <Link href="/impressum">Impressum</Link>.
        </p>
      </Sec>

      <Sec id="ueberblick">
        <p>
          Wir halten die Bearbeitung von Personendaten so gering wie möglich. Beim reinen Besuch dieser Website gilt:
        </p>
        <ul>
          <li>Wir setzen keine Tracking- oder Analyse-Werkzeuge ein und erstellen keine Nutzungsprofile.</li>
          <li>
            Wir binden keine externen Schriftarten, Content-Delivery-Netzwerke, Skripte oder Werbedienste ein. Alle
            Ressourcen der Seiten werden von unseren eigenen Servern ausgeliefert.
          </li>
          <li>
            Besucherinnen und Besucher ohne Anmeldung erhalten keine Cookies. Ein Cookie wird erst nach einer Anmeldung
            gesetzt{siehe("cookies")}.
          </li>
          {(has("newsletter") || has("mail") || has("kontakt")) && (
            <li>
              Wir messen nicht, ob und wie du unsere E-Mails öffnest oder darin klickst; es gibt keine
              Tracking-Pixel{siehe("newsletter")}.
            </li>
          )}
        </ul>
        <p>
          Personendaten bearbeiten wir nur, {joinList(purposes)}. Die Bearbeitung erfolgt nach den Grundsätzen des DSG,
          insbesondere nach Treu und Glauben, verhältnismässig und zweckgebunden.
        </p>
      </Sec>

      <Sec id="hosting">
        <p>
          Diese Website wird von uns selbst betrieben, auf Servern, die wir selbst verantworten. Beim Aufruf einzelner
          Seiten übermittelt dein Browser technisch notwendige Verbindungsdaten, etwa deine IP-Adresse, Datum und Uhrzeit
          der Anfrage, die angeforderte Adresse, den Antwortstatus sowie Angaben zu Browser und Betriebssystem.
        </p>
        <p>
          Diese Daten werden bearbeitet, um die Seiten auszuliefern, die Stabilität und Sicherheit des Betriebs zu
          gewährleisten und Angriffe abzuwehren. Wir werten sie nicht aus, führen sie nicht mit anderen Datenquellen
          zusammen und bewahren sie nur so lange auf, wie es für den sicheren Betrieb nötig ist. Unser Interesse liegt
          im sicheren und störungsfreien Betrieb des Angebots.
        </p>
        {has("tunnel") && (
          <p>
            Je nach Betriebsart kann der Datenverkehr über einen vorgeschalteten Tunnel- oder Proxy-Dienst zu unseren
            Servern geleitet werden (etwa einen Cloudflare Tunnel). Ein solcher Dienst leitet die Verbindung technisch
            weiter und sieht dabei die für die Weiterleitung nötigen Verbindungsdaten.
          </p>
        )}
      </Sec>

      {has("kontakt") && (
        <Sec id="kontakt">
          <p>
            Wenn du uns über das <Link href="/contact">Kontaktformular</Link> schreibst, legen wir aus deinen Angaben ein
            Ticket an. Dabei speichern wir:
          </p>
          <ul>
            <li>Name und E-Mail-Adresse</li>
            <li>Betreff, gewählte Kategorie und Nachricht</li>
            <li>
              die automatisch vergebene Ticketnummer, die Sprache der Anfrage sowie Zeitstempel und Bearbeitungsstatus
            </li>
          </ul>
          <p>
            Zusätzlich können wir interne Notizen zur Bearbeitung des Tickets hinterlegen. Diese Notizen sind für dich
            nicht sichtbar. Antworten, die wir dir zu einem Ticket schicken, speichern wir am Ticket: den Text der
            Antwort, den Namen der antwortenden Person, den Zeitpunkt sowie den Vermerk, ob der E-Mail-Versand erfolgreich
            war (bei einem Fehler zusätzlich die technische Fehlermeldung des Mailservers). Ein Ticket kann einem
            Teammitglied zur Bearbeitung zugewiesen werden.
          </p>
          <h3>E-Mails zum Ticket</h3>
          <p>Zu deinem Ticket versenden wir E-Mails an die von dir angegebene Adresse:</p>
          <ul>
            <li>eine Eingangsbestätigung mit der Ticketnummer, sobald du das Formular abgeschickt hast,</li>
            <li>auf Wunsch des Teams eine Information, wenn sich der Bearbeitungsstatus deines Tickets ändert,</li>
            <li>unsere Antworten auf deine Anfrage.</li>
          </ul>
          <p>
            Ausserdem kann bei einem neuen Ticket eine interne Hinweis-E-Mail an eine vom Betreiber hinterlegte Adresse
            des Teams gesendet werden. Sie enthält die Angaben zum neuen Ticket und dient allein dazu, dass die Anfrage
            zeitnah bearbeitet wird. Der Versand erfolgt über{" "}
            {has("mail") ? `den in ${sec("mail")} beschriebenen SMTP-Server` : "den vom Betreiber eingerichteten SMTP-Server"}.
          </p>
          <h3>Zweck und Grundlage</h3>
          <p>
            Wir bearbeiten die Daten, um deine Anfrage zu beantworten und zu bearbeiten. Die Bearbeitung erfolgt auf
            Grundlage deiner Einwilligung, die du durch das Setzen der Einwilligungs-Checkbox im Formular erteilst. Die
            E-Mails zum Ticket (Eingangsbestätigung, Statusinformationen und Antworten) dienen der Durchführung deiner
            Anfrage; die interne Hinweis-E-Mail an das Team und die Bearbeitung von Sicherheitsmeldungen beruhen auf
            unserem Interesse an einer ordnungsgemässen und zeitnahen Bearbeitung.
          </p>
          <p>
            Die Angabe der Daten ist freiwillig. Ohne die Pflichtfelder können wir dein Anliegen allerdings nicht
            bearbeiten. Deine Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen (siehe{" "}
            {sec("rechte")}).
          </p>
        </Sec>
      )}

      {has("konto") && (
        <Sec id="konto">
          <p>
            Du kannst auf dieser Website ein Nutzerkonto anlegen, sofern der Betreiber die Registrierung aktiviert hat. Die
            Registrierung ist freiwillig; alle öffentlichen Inhalte kannst du auch ohne Konto nutzen.
          </p>
          <h3>Bearbeitete Daten</h3>
          <ul>
            <li>Name und E-Mail-Adresse, die du bei der Registrierung angibst</li>
            <li>
              dein Passwort ausschliesslich als gesalzener bcrypt-Hash; im Klartext wird es zu keinem Zeitpunkt
              gespeichert
            </li>
            <li>
              Zeitstempel der Registrierung, der Bestätigung deiner E-Mail-Adresse und deiner letzten Anmeldung sowie die
              Sprache zum Zeitpunkt der Registrierung
            </li>
            <li>
              Einmal-Links für die E-Mail-Bestätigung und das Zurücksetzen des Passworts, die wir nur als Hash speichern;
              sie sind 48 Stunden (Bestätigung) bzw. 1 Stunde (Passwort-Reset) gültig
            </li>
          </ul>
          <h3>Firmenkunden-Status</h3>
          <p>
            Wenn du im Konto den Status als Firmenkunde beantragst, speichern wir zusätzlich den angegebenen Firmennamen
            und den Stand deines Antrags (ausstehend, freigegeben oder abgelehnt). Das Team entscheidet über den Antrag.
          </p>
          <h3>Teammitglieder</h3>
          <p>
            Für Mitglieder des Teams, denen der Verein einen Team-Bereich freigeschaltet hat, speichern wir zusätzlich
            die vergebene Bezeichnung im Team und, wenn die Person es hochlädt, ein Profilbild. Das Profilbild wird bei
            Antworten auf Tickets angezeigt.
          </p>
          <h3>Zweck und Grundlage</h3>
          <p>
            Wir bearbeiten diese Daten, um dein Konto einzurichten und zu führen, deine E-Mail-Adresse zu bestätigen,
            dich anzumelden und dir bei Bedarf den Zugang zurückzusetzen. Grundlage ist das Nutzungsverhältnis zum Konto,
            das du mit der Registrierung eingehst.
          </p>
          <h3>Aufbewahrung und Löschung</h3>
          <p>
            Wir speichern die Kontodaten bis zur Löschung deines Kontos. Du kannst dein Konto jederzeit selbst unter
            «Konto» löschen. Dabei werden auch die zugehörigen Einmal-Links
            {has("lizenzen") ? ", Lizenzschlüssel und Webspace-Anfragen" : ""} gelöscht.
            {has("kontakt") && (
              <>
                {" "}
                Tickets, die du über das Kontaktformular gesendet hast, sind nicht mit dem Konto verknüpft und bleiben
                davon unberührt{paren("aufbewahrung")}.
              </>
            )}{" "}
            Gesetzliche Aufbewahrungspflichten bleiben vorbehalten.
            {has("mitglieder") && (
              <>
                {" "}
                Die Daten als Vereinsmitglied sind davon getrennt{paren("mitglieder")}.
              </>
            )}
          </p>
        </Sec>
      )}

      {has("lizenzen") && (
        <Sec id="lizenzen">
          <p>
            Im Nutzerkonto kannst du, je nach Angebot, Lizenzschlüssel für unsere Produkte beantragen und eine Anfrage für
            Webspace stellen.
          </p>
          <h3>Bearbeitete Daten</h3>
          <ul>
            <li>
              Lizenzschlüssel: Der Schlüssel liegt nicht im Klartext in der Datenbank, sondern als Prüfwert und
              verschlüsselt, damit du ihn in deinem Konto wiedersehen kannst. Dazu kommen das Produkt, der Status, dein
              Wunsch bzw. Verwendungszweck, ein allfälliger Hinweis des Teams sowie Zeitpunkte der Beantragung und
              Entscheidung.
            </li>
            <li>
              Prüfung des Schlüssels: Programme, die einen Schlüssel prüfen (etwa ein Installer), übermitteln den
              Schlüssel und eine Kennung der Installation, zum Beispiel die Domain. Beim ersten Prüfen wird der Schlüssel
              an diese Installation gebunden. Wir speichern die Kennung, den Zeitpunkt der Bindung, den Zeitpunkt der
              letzten Prüfung und die Zahl der Prüfungen.
            </li>
            <li>Webspace-Anfrage: dein Wunsch bzw. Verwendungszweck, der Status der Anfrage und ein allfälliger Hinweis des Teams.</li>
          </ul>
          <h3>Zweck und Grundlage</h3>
          <p>
            Wir bearbeiten diese Daten, um Schlüssel auszustellen und zu prüfen, Missbrauch (etwa die Weitergabe eines
            Schlüssels an fremde Installationen) zu verhindern und deine Anfragen zu beantworten. Grundlage ist das
            Nutzungsverhältnis zum Konto und deine Anfrage. Die Daten werden mit dem Konto gelöscht{paren("konto")}.
          </p>
        </Sec>
      )}

      {has("mail") && (
        <Sec id="mail">
          {mailUses.length > 0 ? (
            <>
              <p>Wir versenden E-Mails im Zusammenhang mit:</p>
              <ul>
                {mailUses.map((use) => (
                  <li key={use}>{use}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>Wir versenden E-Mails, soweit dies für die Funktionen dieser Website nötig ist.</p>
          )}
          <p>
            Dabei werden deine E-Mail-Adresse, gegebenenfalls dein Name sowie der jeweilige Nachrichteninhalt (etwa ein
            Bestätigungs- oder Rücksetz-Link) bearbeitet.
          </p>
          <p>
            Der Versand erfolgt über den SMTP-Server, den der Betreiber dieser Website eingerichtet hat, das heisst über
            einen eigenen Mailserver oder den E-Mail-Anbieter des Betreibers. Eine Weitergabe der Daten an weitere Dritte
            durch uns findet dabei nicht statt.
            {has("newsletter") && <> Für den Newsletter gilt zusätzlich {sec("newsletter")}.</>}
          </p>
        </Sec>
      )}

      {has("newsletter") && (
        <Sec id="newsletter">
          <p>
            Wenn der Newsletter auf dieser Website aktiviert ist, kannst du dich dafür anmelden. Die Anmeldung ist
            freiwillig; alle Inhalte und Funktionen der Website kannst du auch ohne Newsletter nutzen.
          </p>
          <h3>Zweck und Grundlage</h3>
          <p>
            Wir verwenden deine Daten, um dir per E-Mail Neuigkeiten zu unseren Angeboten und zur Website zuzusenden.
            Grundlage ist deine Einwilligung, die du mit der Anmeldung und der Bestätigung deiner E-Mail-Adresse erteilst.
          </p>
          <h3>Anmeldung im Double-Opt-in-Verfahren</h3>
          <p>
            Nach der Anmeldung senden wir dir eine E-Mail mit einem Bestätigungslink. Erst wenn du diesen Link aufrufst und
            die Bestätigung auf der Seite auslöst, ist deine Anmeldung wirksam und du erhältst den Newsletter. So stellen
            wir sicher, dass niemand fremde Adressen einträgt. Der Bestätigungslink ist nur begrenzt gültig; eine nicht
            bestätigte Anmeldung wird nach Ablauf des Links nicht weiter genutzt, und es werden keine Newsletter an diese
            Adresse gesendet.
          </p>
          <h3>Gespeicherte Daten</h3>
          <ul>
            <li>
              deine E-Mail-Adresse und, wenn du ihn angibst, dein Name (freiwillig) sowie die Sprache der Anmeldung
            </li>
            <li>
              der Zeitpunkt deiner Einwilligung (Anmeldung) und der Zeitpunkt der Bestätigung, als Nachweis der
              Einwilligung
            </li>
            <li>
              der Status deiner Anmeldung (ausstehend, aktiv oder abgemeldet) sowie, im Fall einer Abmeldung, deren
              Zeitpunkt
            </li>
            <li>
              der Bestätigungslink, den wir nur als Hash speichern, und ein zufällig erzeugter Abmelde-Token, der
              Bestandteil des Abmelde-Links in jeder E-Mail ist
            </li>
            <li>
              je Newsletter-Ausgabe (Kampagne) der Zustellstatus, also ob der Versand an deine Adresse erfolgreich war
              oder fehlgeschlagen ist, mit dem Zeitpunkt und gegebenenfalls der technischen Fehlermeldung des Mailservers
            </li>
          </ul>
          <p>
            Wir führen <strong>keine</strong> Erfolgsmessung durch: Es wird weder erfasst, ob du eine E-Mail öffnest, noch,
            ob oder worauf du darin klickst. Wir verwenden keine Tracking-Pixel und keine Zähl- oder Weiterleitungslinks
            zur Auswertung deines Verhaltens.
          </p>
          {has("mitglieder") && (
            <p>
              Für Vereinsmitglieder kann der Verein Newsletter an Gruppen richten (etwa nach Mitgliedschaftsart). Dazu
              wird die E-Mail-Adresse deiner Newsletter-Anmeldung mit den Mitgliederdaten abgeglichen. Ein Mitglied ohne
              Newsletter-Anmeldung erhält keinen Newsletter. Mitteilungen im Rahmen der Mitgliedschaft (etwa Einladungen
              oder Rechnungen) sind kein Newsletter{paren("mitglieder")}.
            </p>
          )}
          <h3>Versand</h3>
          <p>
            Der Newsletter wird über den SMTP-Server versendet, den der Betreiber dieser Website eingerichtet hat
            {paren("mail")}. Eine Weitergabe an weitere Dritte findet nicht statt.
          </p>
          <h3>Widerruf und Abmeldung</h3>
          <p>
            Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen. Jede Newsletter-E-Mail enthält
            dazu einen Abmelde-Link, über den du dich mit einem Klick abmelden kannst. Darüber hinaus unterstützen wir die
            Abmeldefunktion deines E-Mail-Programms (One-Click-Abmeldung über den Header «List-Unsubscribe»). Alternativ
            genügt eine Nachricht an die unter {sec("verantwortlicher")} genannte E-Mail-Adresse. Die Rechtmässigkeit der
            bis zum Widerruf erfolgten Bearbeitung bleibt unberührt.
          </p>
          <h3>Aufbewahrung</h3>
          <p>
            Wir speichern deine Daten, bis du deine Einwilligung widerrufst. Nach der Abmeldung führen wir deine
            E-Mail-Adresse als abgemeldet weiter, damit dir nicht versehentlich erneut Newsletter zugesendet werden und
            dein Widerruf nachweisbar bleibt. Möchtest du, dass wir deine Daten vollständig löschen, teile uns das mit (
            {sec("rechte")}); wir löschen sie dann, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
            Bitte beachte, dass damit auch der Schutz vor einer erneuten Zusendung entfällt.
          </p>
        </Sec>
      )}

      {has("cookies") && (
        <Sec id="cookies">
          <p>
            Besucherinnen und Besucher ohne Anmeldung erhalten keine Cookies. Nach einer erfolgreichen Anmeldung setzen wir
            den technisch notwendigen Cookie <code>{SESSION_COOKIE}</code>.
          </p>
          <ul>
            <li>
              Er ist als <code>httpOnly</code> gekennzeichnet, für JavaScript also nicht auslesbar, und mit{" "}
              <code>SameSite=Lax</code> sowie <code>Secure</code> (nur über verschlüsselte Verbindungen) versehen.
            </li>
            <li>
              Er enthält ausschliesslich ein signiertes Sitzungstoken mit Konto-Kennung, Name, E-Mail-Adresse und Rolle.
            </li>
            <li>
              Seine Laufzeit beträgt höchstens 14 Tage (bei der Anmeldung des Teams im Verwaltungsbereich 8 Stunden). Beim
              Abmelden wird er entfernt.
            </li>
          </ul>
          <p>
            Der Cookie ist unbedingt erforderlich, damit der von dir ausdrücklich angeforderte Dienst, nämlich die
            Anmeldung, bereitgestellt werden kann. Mit dieser Erklärung und dem Cookie-Hinweis informieren wir dich über
            Cookies und ihren Zweck (Art. 45c des Fernmeldegesetzes); weil nur dieser notwendige Cookie zum Einsatz kommt,
            gibt es nichts abzulehnen.
          </p>
          <h3>Cookie-Hinweis und Einstellungen</h3>
          <p>
            Beim Besuch der Website blenden wir einen Cookie-Hinweis ein, in dem du dich über die eingesetzten Cookies
            informieren und deine Einstellungen vornehmen kannst. Derzeit setzen wir ausschliesslich den oben genannten,
            technisch notwendigen Cookie ein; Analyse- und Marketing-Cookies kommen nicht zum Einsatz. Würden wir künftig
            optionale Kategorien einführen, würden wir sie nur mit deiner vorherigen Einwilligung aktivieren.
          </p>
          <h3>Lokaler Speicher im Browser</h3>
          <p>
            Zwei Einträge speichern wir ausschliesslich lokal in deinem Browser (Local Storage); es sind keine Cookies, und
            sie werden nicht an uns oder an Dritte übertragen:
          </p>
          <ul>
            <li>
              <code>{STORAGE_KEY}</code>: deine Auswahl im Cookie-Hinweis, damit wir dich nicht bei jedem Besuch erneut
              fragen.
            </li>
            <li>
              <code>{THEME_KEY}</code>: deine Wahl der Darstellung (hell, dunkel oder System), wenn du sie im Footer oder
              im Profil-Menü änderst.
            </li>
          </ul>
          <p>
            Du kannst die Einträge jederzeit in den Einstellungen deines Browsers löschen; dann wird der Cookie-Hinweis
            wieder angezeigt bzw. die Darstellung folgt wieder deinem System. Deine Cookie-Einstellungen kannst du
            jederzeit ändern: Über den Link «Cookie-Einstellungen» im Footer der Website öffnest du den
            Einstellungs-Dialog erneut.
          </p>
        </Sec>
      )}

      {has("missbrauchsschutz") && (
        <Sec id="missbrauchsschutz">
          <p>
            Um das Kontaktformular sowie Anmeldung, Registrierung und Passwort-Reset vor automatisiertem Missbrauch zu
            schützen, begrenzen wir die Zahl der Anfragen pro Zeitraum. Dafür wird deine IP-Adresse (bei Anmeldung und
            Registrierung teilweise zusätzlich in Verbindung mit der eingegebenen E-Mail-Adresse) flüchtig im
            Arbeitsspeicher des Servers bearbeitet. Sie wird nicht dauerhaft gespeichert und nicht in der Datenbank
            abgelegt; nach Ablauf des Zeitfensters oder einem Neustart des Dienstes ist sie nicht mehr vorhanden.
          </p>
          <p>
            Zusätzlich enthält das Kontaktformular ein für Menschen unsichtbares Feld (Honeypot). Es dient allein dazu,
            automatisierte Einsendungen zu erkennen, und erhebt keine Personendaten. Unser Interesse liegt im Schutz vor
            Missbrauch und in der Sicherung des Betriebs.
          </p>
        </Sec>
      )}

      {has("mitglieder") && (
        <Sec id="mitglieder">
          <p>
            Der Verein führt ein Mitgliederverzeichnis. Darin bearbeiten wir Daten von Personen, die einen Beitritt
            beantragen, Mitglied sind oder waren. Die Verwaltung erfolgt im geschützten Verwaltungsbereich durch den
            Vorstand. Ein Beitrittsformular auf der Website steht zur Verfügung, wenn der Verein es aktiviert hat.
          </p>
          <h3>Bearbeitete Daten</h3>
          <ul>
            <li>
              Stammdaten: Anrede (freiwillig), Vor- und Nachname, Anschrift, E-Mail-Adresse und Telefonnummer; das
              Geburtsdatum nur, wenn der Verein es erhebt. Pflichtangaben sind Name und eine Kontaktmöglichkeit.
            </li>
            <li>
              Angaben zur Mitgliedschaft: Mitgliedernummer, Mitgliedschaftsart, Status (Antrag, abgelehnt, aktiv,
              ausgetreten, ausgeschlossen oder verstorben), Eingang des Antrags, Eintritts- und Austrittsdatum,
              Austrittsgrund und der gewünschte Kommunikationsweg (E-Mail oder Post)
            </li>
            <li>Ämter im Verein (etwa Präsident oder Kassier) mit der Amtszeit</li>
            <li>der Zeitpunkt, zu dem du im Beitrittsantrag die Statuten und den Datenschutzhinweis bestätigt hast</li>
            <li>interne Notizen des Vorstands, die nur für den Vorstand sichtbar sind</li>
            <li>die Verknüpfung mit deinem Website-Konto, falls du eines hast und es mit der Mitgliedschaft verbunden ist</li>
          </ul>
          <h3>Zweck und Grundlage</h3>
          <p>
            Wir bearbeiten diese Daten, um das Mitgliederverzeichnis zu führen, Beitrittsanträge zu behandeln, die
            Mitgliedschaft zu verwalten (Beiträge, Einladungen, Stimmrecht, Ämter) und mit dir zu kommunizieren. Grundlage
            sind dein Beitrittsantrag und das Mitgliedschaftsverhältnis nach den Statuten; im Antrag bestätigst du
            Statuten und Datenschutzhinweis.
          </p>
          <h3>Empfänger und Zugriff</h3>
          <p>
            Zugriff auf Mitgliederdaten haben nur Personen mit einer entsprechenden Rolle im Verein (rollenbasierter
            Zugriff). Mitgliederlisten und Exporte sind auf Rollen mit Leserecht beschränkt. Welche Rolle was sehen und
            ändern darf, stellt der Verein ein; interne Notizen des Vorstands sehen nur Rollen, denen der Verein dieses
            Recht ausdrücklich gegeben hat (Datenminimierung). Als Mitglied siehst du im
            Mitgliederportal ausschliesslich deine eigenen Daten. Eine Weitergabe an Dritte findet nicht statt, ausser wir
            sind dazu gesetzlich verpflichtet. Mitteilungen an dich versenden wir über den eingerichteten SMTP-Server
            {paren("mail")}.
          </p>
          <h3>Aufbewahrung und Löschung</h3>
          <p>
            Wir speichern die Daten, solange du Mitglied bist. Ist ein Austritt gemeldet, setzt ein täglicher automatischer
            Lauf den Status nach Ablauf des eingetragenen Austrittsdatums auf «ausgetreten»; dabei werden keine weiteren
            Daten bearbeitet. Nach einem Austritt, Ausschluss oder Todesfall bewahren wir
            sie nur noch, soweit dies nötig ist, etwa für offene Forderungen, Buchhaltungsbelege, Protokolle und das
            Mitgliederverzeichnis der Vereinsgeschichte. Darüber hinaus entfernt der Vorstand die Personendaten
            (Kontaktdaten, Geburtsdatum, Notizen); Mitgliedernummer, Status sowie Eintritts- und Austrittsdatum bleiben
            bestehen. Das ist nur möglich, wenn keine Forderungen mehr offen sind.
          </p>
          {rights(
            <>
              Löschbegehren setzen wir um, soweit keine gesetzliche Aufbewahrungspflicht entgegensteht
              {paren("beitraege")}.
            </>,
          )}
        </Sec>
      )}

      {has("ausweis") && (
        <Sec id="ausweis">
          <p>
            Als Mitglied, dessen Website-Konto mit der Mitgliedschaft verbunden ist, kannst du im Mitgliederportal einen
            digitalen Mitgliederausweis anzeigen.
          </p>
          <h3>Bearbeitete Daten</h3>
          <p>
            Der Ausweis wird aus deinen Mitgliederdaten erzeugt, insbesondere aus Name, Mitgliedernummer,
            Mitgliedschaftsart und Status{paren("mitglieder")}. Er wird dir nach der Anmeldung in deinem Konto angezeigt.
          </p>
          <h3>Zweck und Grundlage</h3>
          <p>
            Der Ausweis dient dem Nachweis deiner Mitgliedschaft, etwa an Anlässen. Grundlage ist das
            Mitgliedschaftsverhältnis. Wem du den Ausweis zeigst, entscheidest du selbst.
          </p>
          <h3>Empfänger und Zugriff</h3>
          <p>
            Der Ausweis ist nur nach Anmeldung in deinem Konto sichtbar. Es erfolgt keine Weitergabe an Dritte.
          </p>
          <h3>Aufbewahrung und Löschung</h3>
          <p>
            Für den Ausweis gelten dieselben Aufbewahrungs- und Löschregeln wie für die Mitgliederdaten
            {paren("mitglieder", "aufbewahrung")}.
          </p>
          {rights()}
        </Sec>
      )}

      {has("tuerkontrolle") && (
        <Sec id="tuerkontrolle">
          <p>
            An Anlässen kann der Verein die Mitgliedschaft an der Tür mit der Android-App «Vylaris Scanner» prüfen. Die App
            funktioniert nur auf Geräten, die der Vorstand in der Verwaltung gekoppelt hat; der Vorstand kann ein Gerät
            jederzeit sperren, ein gesperrtes Gerät erhält keine Angaben mehr.
          </p>
          <h3>Bearbeitete Daten</h3>
          <ul>
            <li>
              Prüfung des Ausweises: Die App sendet nur die Kennung aus dem QR-Code deines Mitgliederausweises{paren("ausweis")} an
              diese Website. Die Website antwortet, ob deine Mitgliedschaft gültig ist, und liefert Name, Mitgliedernummer, Status,
              Eintrittsdatum, Mitgliedschaftsart und aktuelle Ämter. Das gilt auch, wenn die Mitgliedschaft nicht mehr aktiv ist.
            </li>
            <li>
              Manuelle Suche: Ist der Ausweis nicht zur Hand, sucht die Türkontrolle nach Name oder Mitgliedernummer. Die Suche zeigt
              dieselben Angaben und findet auch frühere Mitglieder, deren Daten nicht anonymisiert sind{paren("mitglieder")}.
            </li>
            <li>
              Anmeldung zu einem Anlass: Wählt die Türkontrolle einen Anlass, zeigt sie dazu deine Anmeldung{paren("anlaesse")}: Status,
              Zahl der Plätze, den Zeitpunkt einer Anwesenheit und deine Anmerkung. Die Anmerkung ist ein Freitext und kann
              Gesundheitsangaben enthalten, etwa Allergien, wenn du sie dort eingetragen hast.
            </li>
            <li>
              Check-in: Trägt die Türkontrolle dich als anwesend ein (auch von Hand oder rückgängig), vermerkt die Website die
              Anwesenheit bei deiner Anmeldung. Im Änderungsprotokoll{paren("audit")} stehen die Mitgliedernummer, der Anlass, der
              Zeitpunkt und das verwendete Gerät; dein Name steht dort nicht.
            </li>
          </ul>
          <h3>Zweck und Grundlage</h3>
          <p>
            Wir bearbeiten die Angaben, um an der Tür zu prüfen, ob eine Person Mitglied ist und für den Anlass angemeldet ist, und
            um die Anwesenheit festzuhalten. Grundlage ist das Mitgliedschaftsverhältnis und das Interesse des Vereins an einer
            geordneten Durchführung seiner Anlässe.
          </p>
          <h3>Empfänger und Zugriff</h3>
          <p>
            Die Angaben gehen nur an ein gültiges, vom Vorstand gekoppeltes Gerät und werden dort angezeigt. Die Angaben werden in
            der App nur angezeigt; sie sind nicht dafür vorgesehen, dort gespeichert zu werden. Es erfolgt keine Weitergabe an
            Dritte. Abfragen werden nicht protokolliert, nur Eingriffe (Check-in und dessen Rücknahme).
          </p>
          <h3>Aufbewahrung und Löschung</h3>
          <p>
            Es gelten dieselben Aufbewahrungs- und Löschregeln wie für die Mitgliederdaten und die Anmeldungen
            {paren("mitglieder", "anlaesse", "aufbewahrung")}. Einträge im Änderungsprotokoll bleiben bestehen{paren("audit")}.
          </p>
          {rights()}
        </Sec>
      )}

      {has("beitraege") && (
        <Sec id="beitraege">
          <p>
            Der Verein erhebt Mitgliederbeiträge, stellt Rechnungen, erfasst Zahlungen und führt die Buchhaltung des
            Vereins. Dabei bearbeiten wir Personendaten von Mitgliedern und von Personen, die an den Verein zahlen oder von
            ihm Zahlungen erhalten.
          </p>
          <h3>Bearbeitete Daten</h3>
          <ul>
            <li>
              Rechnungen: Rechnungsnummer, Empfänger mit Name und Anschrift zum Zeitpunkt der Rechnungsstellung
              (Momentaufnahme), Betreff, Positionen und Beträge, Rechnungs- und Fälligkeitsdatum, Zahlungsreferenz, Status
              sowie der Zeitpunkt des Versands
            </li>
            <li>
              Zahlungen: Datum und Betrag, Zahlungsart (Überweisung, bar, TWINT oder andere), Zahlungsreferenz bzw.
              Buchungstext der Bank, die Zuordnung zu Rechnung und Mitglied sowie der Name der Person, die die Zahlung
              erfasst hat
            </li>
            <li>
              Mahnungen: Mahnstufe, neue Zahlungsfrist, allfällige Mahngebühr, Zeitpunkt des Versands und der Vermerk, ob
              der E-Mail-Versand erfolgreich war
            </li>
            <li>
              Buchhaltung: Buchungen mit Datum, Betrag, Konto, Buchungstext, Belegnummer und Beleg-Referenz sowie
              hochgeladene Belege (Scans, Fotos oder PDF) mit Dateiname, Prüfsumme und dem Namen der hochladenden Person;
              Budget und Jahresabschluss. Buchungstexte und Belege können Personendaten enthalten, etwa bei Spenden oder
              Auslagen.
            </li>
          </ul>
          <h3>Zweck und Grundlage</h3>
          <p>
            Wir bearbeiten diese Daten, um Beiträge zu erheben, den Zahlungsverkehr nachzuvollziehen, offene Forderungen zu
            verfolgen und die Buchführung ordnungsgemäss zu führen und den Mitgliedern gegenüber Rechenschaft abzulegen.
            Grundlage sind das Mitgliedschaftsverhältnis (Beitragspflicht nach den Statuten) und die gesetzlichen Pflichten
            zur Buchführung und Aufbewahrung (Art. 69a ZGB, Art. 957 ff. OR).
          </p>
          <h3>Empfänger und Zugriff</h3>
          <p>
            Zugriff haben nur Personen mit einer entsprechenden Rolle, in der Regel Kassier und Vorstand, die
            Revisionsstelle lesend. Rechnungen und Mahnungen senden wir dir per E-Mail über den eingerichteten
            SMTP-Server{paren("mail")}. Im Mitgliederportal siehst du ausschliesslich deine eigenen Rechnungen. Eine
            Weitergabe an Dritte findet nicht statt, ausser wir sind dazu gesetzlich verpflichtet.
          </p>
          <h3>Aufbewahrung und Löschung</h3>
          <p>
            Buchungen, Belege und die zugehörigen Geschäftsunterlagen (Rechnungen, Zahlungen) bewahren wir zehn Jahre auf
            (Art. 958f OR); die Frist beginnt mit dem Ablauf des Geschäftsjahres. Während dieser Zeit können sie nicht
            gelöscht werden. Nach dem Abschluss eines Geschäftsjahres ändern wir Buchungen nicht mehr, sondern korrigieren
            sie mit einer Gegenbuchung. Die Rechnung behält den Empfänger der Rechnungsstellung, auch wenn Personendaten
            des Mitglieds später entfernt werden.
          </p>
          {rights(
            "Löschung und Sperrung sind für Unterlagen, die wir aufbewahren müssen, bis zum Ablauf der Aufbewahrungsfrist nicht möglich."
          )}
        </Sec>
      )}

      {has("versammlungen") && (
        <Sec id="versammlungen">
          <p>
            Der Verein lädt zu Versammlungen (Mitglieder-, Vorstands- und ausserordentliche Versammlungen) ein, führt
            Protokoll und hält Beschlüsse fest.
          </p>
          <h3>Bearbeitete Daten</h3>
          <ul>
            <li>
              Einladung: Titel, Datum, Ort und Begleittext, der Zeitpunkt des Versands und die Zahl der Empfänger
            </li>
            <li>Traktanden mit Anträgen sowie Leitung und Protokollführung (mit Namen)</li>
            <li>
              Anwesenheit: wer anwesend, entschuldigt oder abwesend war, und ob die Person zum Zeitpunkt der Versammlung
              stimmberechtigt war
            </li>
            <li>
              Protokoll mit dem Vermerk der Genehmigung sowie Beschlüsse mit Text, Ergebnis und Stimmenzahlen (als Zahlen,
              nicht je Person)
            </li>
            <li>Aufgaben, die sich aus Beschlüssen ergeben, mit zuständiger Person und Termin</li>
          </ul>
          <h3>Zweck und Grundlage</h3>
          <p>
            Wir bearbeiten diese Daten, um Versammlungen vorzubereiten und durchzuführen, die Beschlussfassung zu
            dokumentieren und den Mitgliedern Auskunft zu geben. Grundlage sind die Statuten und das Vereinsrecht
            (Art. 64 ff. ZGB).
          </p>
          <h3>Empfänger und Zugriff</h3>
          <p>
            Einladungen senden wir per E-Mail an die Mitglieder über den eingerichteten SMTP-Server{paren("mail")}.
            Versammlungen und Termine kannst du im Mitgliederportal ansehen und als Kalenderdatei herunterladen. Ob ein
            Protokoll nur dem Vorstand, den Mitgliedern oder öffentlich zugänglich ist, bestimmt die Sichtbarkeit des
            Dokuments{paren("dokumente")}. Intern haben nur Personen mit entsprechender Rolle Zugriff.
          </p>
          <h3>Aufbewahrung und Löschung</h3>
          <p>
            Protokolle und Beschlüsse gehören zu den Unterlagen des Vereins. Wir bewahren sie auf, solange sie für die
            Führung des Vereins und den Nachweis von Beschlüssen nötig sind; eine automatische Löschung findet nicht statt.
          </p>
          {rights()}
        </Sec>
      )}

      {has("anlaesse") && (
        <Sec id="anlaesse">
          <p>
            Der Verein veranstaltet Anlässe. Die Anmeldung ist für Mitglieder möglich und, wenn der Verein einen Anlass
            dafür öffnet, auch für Gäste. Veröffentlichte Anlässe sind auf der Website sichtbar.
          </p>
          <h3>Bearbeitete Daten</h3>
          <ul>
            <li>Anmeldung von Mitgliedern: die Zuordnung zum Mitglied, die Zahl der Plätze, eine allfällige Bemerkung und der Status (angemeldet, Warteliste, abgesagt) mit Zeitpunkten</li>
            <li>
              Anmeldung von Gästen: Name und E-Mail-Adresse, Zahl der Plätze (inklusive Begleitung), eine allfällige
              Bemerkung sowie der Zeitpunkt deiner Einwilligung zur Datenbearbeitung. Die Anmeldung gilt erst, wenn du
              deine E-Mail-Adresse bestätigt hast (siehe unten); bis dahin ist sie «unbestätigt» und reserviert keinen Platz
            </li>
            <li>
              Bestätigungs-Link: Er steht nur in der E-Mail, die wir nach deiner Anmeldung an die angegebene Adresse senden. Er
              enthält eine Signatur und einen Ablaufzeitpunkt, aber keine Personendaten; gespeichert wird nur der Zeitpunkt des
              letzten Versands
            </li>
            <li>
              Abmelde-Link: Er steht nur in der Bestätigungs-E-Mail, die wir nach deiner Bestätigung senden; wir speichern davon
              nur einen Hash (Prüfwert)
            </li>
          </ul>
          <h3>Zweck und Grundlage</h3>
          <p>
            Wir bearbeiten die Daten, um den Anlass zu planen und durchzuführen, Plätze und die Warteliste zu verwalten und
            dir deine Anmeldung zu bestätigen. Grundlage ist deine Anmeldung; bei Gästen zusätzlich die Einwilligung, die
            du bei der Anmeldung erteilst und mit Wirkung für die Zukunft widerrufen kannst.
          </p>
          <h3>Bestätigung der E-Mail-Adresse (Gäste)</h3>
          <p>
            Damit niemand mit einer fremden Adresse Anmeldungen auslösen kann, prüfen wir bei Gästen die E-Mail-Adresse
            («Double-Opt-In»): Nach dem Absenden des Formulars senden wir dir eine E-Mail mit einem Link. Erst wenn du auf
            der Seite, die sich öffnet, die Schaltfläche «Anmeldung bestätigen» anklickst, gilt deine Anmeldung. Dann
            erhältst du einen Platz oder, wenn der Anlass ausgebucht ist, einen Platz auf der Warteliste, und wir senden
            dir die Bestätigung mit dem Link zum Abmelden. Der Link gilt 48 Stunden. Bestätigst du nicht innerhalb von 48
            Stunden, verfällt die Anmeldung; wir löschen sie samt Name, E-Mail-Adresse und Bemerkung im täglichen
            Aufräumlauf, spätestens drei Tage nach deiner Anmeldung. Wiederholst du die
            Anmeldung mit derselben Adresse, senden wir höchstens alle paar Minuten eine neue E-Mail. Mitglieder, die im
            Mitgliederportal angemeldet sind, müssen nichts bestätigen.
          </p>
          <h3>Empfänger und Zugriff</h3>
          <p>
            Die Anmeldungen sehen nur Personen mit entsprechender Rolle im Verein. Die Bestätigung senden wir über den
            eingerichteten SMTP-Server{paren("mail")}. Teilnehmerlisten werden nicht veröffentlicht. Eine Weitergabe an
            Dritte findet nicht statt.
          </p>
          <h3>Aufbewahrung und Löschung</h3>
          <p>
            Unbestätigte Anmeldungen von Gästen verfallen nach 48 Stunden und werden im täglichen Aufräumlauf gelöscht,
            spätestens drei Tage nach der Anmeldung. Bestätigte Angaben von Gästen (Name, E-Mail-Adresse, Bemerkung)
            bewahren wir bis {GUEST_RETENTION_DAYS} Tage nach dem Anlass auf; danach werden sie im täglichen Aufräumlauf entfernt. Die
            Anmeldung bleibt dann ohne Personenbezug als Zahl der Plätze bestehen. Auf Wunsch löschen wir deine Angaben
            früher: Schreib uns die E-Mail-Adresse, mit der du dich angemeldet hast. Wir suchen alle Anmeldungen zu dieser
            Adresse, geben dir Auskunft darüber und löschen sie auf Verlangen. Anmeldungen von Mitgliedern gehören zu den Mitgliederdaten{paren("mitglieder")}. Mit dem Abmelde-Link kannst du
            dich jederzeit abmelden.
          </p>
          {rights()}
        </Sec>
      )}

      {has("dokumente") && (
        <Sec id="dokumente">
          <p>
            Der Verein legt Dokumente ab, etwa Statuten, Reglemente, Protokolle und Finanzunterlagen, und stellt sie je nach
            Sichtbarkeit zur Verfügung.
          </p>
          <h3>Bearbeitete Daten</h3>
          <ul>
            <li>
              Angaben zum Dokument: Titel, Beschreibung, Kategorie (Statuten, Reglement, Protokoll, Finanzen oder
              Sonstiges), Sichtbarkeit (öffentlich, Mitglieder oder Vorstand) und, falls zutreffend, die zugehörige
              Versammlung
            </li>
            <li>
              Angaben zur Datei und zu jeder Fassung: Dateiname, Grösse, Prüfsumme, Zeitpunkt und der Name der Person, die
              sie hochgeladen hat
            </li>
            <li>der Inhalt der Dokumente selbst, der Personendaten enthalten kann (etwa in Protokollen)</li>
          </ul>
          <h3>Zweck und Grundlage</h3>
          <p>
            Wir bearbeiten diese Daten, um Unterlagen des Vereins geordnet aufzubewahren und den berechtigten Personen
            zugänglich zu machen. Grundlage sind die Vereinsführung nach den Statuten und das Interesse der Mitglieder an
            Transparenz.
          </p>
          <h3>Empfänger und Zugriff</h3>
          <p>
            Wer ein Dokument sehen darf, richtet sich nach seiner Sichtbarkeit: Öffentliche Dokumente (etwa die Statuten)
            kann jede Besucherin und jeder Besucher abrufen, Dokumente für Mitglieder nur Mitglieder nach der Anmeldung,
            Dokumente für den Vorstand nur Rollen, denen der Verein dieses Recht ausdrücklich gegeben hat.
          </p>
          <h3>Aufbewahrung und Löschung</h3>
          <p>
            Frühere Fassungen eines Dokuments bleiben erhalten. Dokumente bewahren wir auf, solange der Verein sie braucht;
            sie können archiviert werden. Für Protokolle gilt zusätzlich{" "}
            {has("versammlungen") ? sec("versammlungen") : "die übliche Aufbewahrung von Vereinsunterlagen"}.
          </p>
          {rights()}
        </Sec>
      )}

      {has("audit") && (
        <Sec id="audit">
          <p>
            Sensible Änderungen in der Vereinsverwaltung halten wir in einem Änderungsprotokoll fest, damit
            nachvollziehbar bleibt, wer wann was geändert hat.
          </p>
          <h3>Bearbeitete Daten</h3>
          <ul>
            <li>
              Zeitpunkt, handelnde Person (Name zum Zeitpunkt der Änderung und Kennung des Kontos) und Art der Handlung
            </li>
            <li>
              die Handlung (etwa Mitglied geändert oder ausgetreten, Rolle geändert, Rechnung erstellt oder storniert,
              Buchung korrigiert, Jahr abgeschlossen, Einstellungen geändert, Export von Mitgliederlisten, Check-in
              an der Türkontrolle mit Mitgliedernummer und Gerät, aber ohne Name) und das
              betroffene Objekt mit Typ und Kennung
            </li>
            <li>
              ein kurzer Klartext sowie die geänderten Werte vorher und nachher. Passwörter, Zugangstoken und andere
              Geheimnisse werden nicht protokolliert.
            </li>
          </ul>
          <h3>Zweck und Grundlage</h3>
          <p>
            Das Protokoll dient der Nachvollziehbarkeit, der Datensicherheit und dem Schutz vor Missbrauch. Grundlage ist
            unser Interesse an einer sicheren und nachvollziehbaren Vereinsführung.
          </p>
          <h3>Empfänger und Zugriff</h3>
          <p>
            Einsehen können das Protokoll nur Konten mit der Berechtigung «Änderungsprotokoll», in der Regel
            Administratoren, Präsident, Vize-Präsident und Revisionsstelle. Eine Weitergabe an Dritte findet nicht statt.
          </p>
          <h3>Aufbewahrung und Löschung</h3>
          <p>
            Einträge werden nicht nachträglich geändert oder einzeln gelöscht und bleiben auch bestehen, wenn das Konto
            oder der betroffene Datensatz später gelöscht wird. Löschbegehren prüfen wir im Einzelfall gegen das Interesse
            an der Nachvollziehbarkeit.
          </p>
          {rights()}
        </Sec>
      )}

      <Sec id="empfaenger">
        <p>
          Deine Daten werden auf unseren eigenen Servern bearbeitet. Eine Weitergabe an Dritte findet nicht statt, es sei
          denn, wir sind dazu gesetzlich verpflichtet. Ausnahmen bilden der E-Mail-Versand über den vom Betreiber
          konfigurierten SMTP-Server
          {has("mail") ? ` (${sec("mail")})` : ""}
          {has("kontakt") || has("newsletter") ? (
            <>
              ; über ihn laufen auch {joinList([has("kontakt") && `die Mails zu Tickets (${sec("kontakt")})`, has("newsletter") && `der Newsletter (${sec("newsletter")})`].filter(Boolean) as string[], " und ")}
            </>
          ) : null}
          .{has("tunnel") && <> Bei Betrieb über einen Tunnel- oder Proxy-Dienst (z. B. Cloudflare) ist dieser Dienst Empfänger der
          Verbindungsdaten{paren("hosting")}.</>}{" "}
          Intern erhalten nur diejenigen Mitglieder des Teams Zugriff, die{" "}
          {webData.length > 0 && <>{joinList(webData, " und ")} verwalten, </>}Mitteilungen versenden oder den Betrieb
          sicherstellen.
          {anyVerein && (
            <>
              {" "}
              Auf Mitglieder-, Rechnungs- und Buchungsdaten greifen nur Personen mit der entsprechenden Rolle im Vorstand
              zu, die Revisionsstelle lesend.
            </>
          )}
        </p>
      </Sec>

      <Sec id="ausland">
        <p>
          {has("tunnel") ? (
            <>
              Bei Nutzung eines Tunnel- oder Proxy-Dienstes{paren("hosting")} können Verbindungsdaten (IP-Adresse,
              aufgerufene Seite, Zeitpunkt) in Länder ausserhalb der Schweiz gelangen, auch in Länder ohne angemessenen
              Datenschutz. Wir stellen den Schutz durch geeignete Garantien sicher (z. B. Standardvertragsklauseln, Art. 16
              Abs. 2 DSG). Darüber hinaus gibt diese Website von sich aus keine Personendaten ins Ausland bekannt.
            </>
          ) : (
            <>Diese Website gibt von sich aus keine Personendaten ins Ausland bekannt.</>
          )}{" "}
          Für den E-Mail-Versand ist der Standort des vom Betreiber eingesetzten Mailservers massgeblich; befindet er sich
          in einem Land ohne angemessenen Datenschutz, stellt der Betreiber durch geeignete Garantien einen angemessenen
          Schutz sicher (Art. 16 DSG).
        </p>
      </Sec>

      <Sec id="aufbewahrung">
        <p>
          Wir bewahren Personendaten nur so lange auf, wie es für den jeweiligen Zweck nötig ist oder eine gesetzliche
          Pflicht es verlangt{anyRetention ? ":" : "."}
        </p>
        {anyRetention && (
        <ul>
          {has("kontakt") && (
            <li>
              Tickets und Antworten: so lange, wie es zur Bearbeitung deiner Anfrage erforderlich ist, und, soweit
              gesetzliche Aufbewahrungspflichten bestehen, für die Dauer dieser Fristen. Danach löschen wir sie von Hand;
              auf Anfrage geschieht das jederzeit.
            </li>
          )}
          {has("konto") && (
            <>
              <li>
                Nutzerkonto{has("lizenzen") ? " samt Lizenzschlüsseln und Webspace-Anfragen" : ""}: bis zur Löschung des
                Kontos, die du selbst vornehmen kannst.
              </li>
              <li>
                Einmal-Links für E-Mail-Bestätigung und Passwort-Reset: nur als Hash und nur bis zum Ablauf der Gültigkeit
                bzw. bis zur Verwendung von Bedeutung.
              </li>
            </>
          )}
          {!has("konto") && has("lizenzen") && <li>Lizenzschlüssel und Webspace-Anfragen: bis zur Löschung des Kontos.</li>}
          {has("newsletter") && <li>Newsletter-Anmeldung: bis zum Widerruf, danach nur als «abgemeldet» geführt{paren("newsletter")}.</li>}
          {has("missbrauchsschutz") && (
            <li>IP-Adresse zum Missbrauchsschutz: flüchtig im Arbeitsspeicher{paren("missbrauchsschutz")}.</li>
          )}
          {has("mitglieder") && (
            <li>
              Mitgliederdaten: während der Mitgliedschaft; danach nur noch, soweit nötig, dann werden die Personendaten
              entfernt{paren("mitglieder")}.
            </li>
          )}
          {has("beitraege") && (
            <li>
              Rechnungen, Zahlungen, Buchungen und Belege: zehn Jahre nach Art. 958f OR{paren("beitraege")}.
            </li>
          )}
          {has("versammlungen") && <li>Protokolle und Beschlüsse: solange der Verein sie braucht{paren("versammlungen")}.</li>}
          {has("anlaesse") && <li>Anmeldungen von Gästen: unbestätigte spätestens drei Tage, bestätigte bis {GUEST_RETENTION_DAYS} Tage nach dem Anlass{paren("anlaesse")}.</li>}
          {has("dokumente") && <li>Dokumente: solange der Verein sie braucht, frühere Fassungen bleiben erhalten{paren("dokumente")}.</li>}
          {has("audit") && <li>Änderungsprotokoll: Einträge bleiben bestehen und werden nicht nachträglich geändert{paren("audit")}.</li>}
        </ul>
        )}
        <p>
          Möchtest du, dass wir Daten vorzeitig löschen, schreib uns an die unter {sec("verantwortlicher")} genannte
          Adresse ({sec("rechte")}).
        </p>
      </Sec>

      {has("links") && (
        <Sec id="links">
          <p>
            Diese Website verlinkt auf externe Seiten, etwa auf andere Standorte der VylarisGroup, auf unsere Kanäle bei X,
            YouTube, Instagram und Discord, auf WhatsApp als Kontaktweg oder auf Quellen im Web. Beim blossen Anzeigen
            unserer Seiten werden keine Daten an diese Seiten übermittelt. Erst wenn du einem Link folgst, gelten die
            Datenschutzbestimmungen des jeweiligen Betreibers; auf diese haben wir keinen Einfluss.
          </p>
        </Sec>
      )}

      <Sec id="rechte">
        <p>Dir stehen nach dem DSG insbesondere folgende Rechte zu:</p>
        <ul>
          <li>Auskunft darüber, ob und welche Personendaten wir von dir bearbeiten (Art. 25 DSG)</li>
          <li>Herausgabe oder Übertragung deiner Daten in einem gängigen elektronischen Format (Art. 28 DSG)</li>
          <li>Berichtigung unrichtiger Daten sowie Löschung, Sperrung oder Widerspruch gegen die Bearbeitung (Art. 32 DSG)</li>
        </ul>
        <p>
          Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen. Die Rechtmässigkeit der
          bis dahin erfolgten Bearbeitung bleibt davon unberührt.
          {has("newsletter") && (
            <>
              {" "}
              Die Einwilligung in den Newsletter widerrufst du am einfachsten über den Abmelde-Link in jeder
              Newsletter-E-Mail{paren("newsletter")}.
            </>
          )}
          {has("beitraege") && (
            <>
              {" "}
              Für Unterlagen, die wir gesetzlich aufbewahren müssen, gelten Einschränkungen bei Löschung und Sperrung
              {paren("beitraege")}.
            </>
          )}
        </p>
        <p>
          Zur Ausübung deiner Rechte genügt eine Nachricht an die unter {sec("verantwortlicher")} genannte E-Mail-Adresse
          oder über das <Link href="/contact">Kontaktformular</Link>. Zum Schutz deiner Daten können wir einen Nachweis
          deiner Identität verlangen. Auskunftsbegehren beantworten wir in der Regel innert 30 Tagen.
        </p>
        <p>
          Du kannst dich ausserdem an den Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) wenden und
          bei ihm Anzeige erstatten, wenn du der Ansicht bist, dass wir Personendaten rechtswidrig bearbeiten:{" "}
          <a href="https://www.edoeb.admin.ch" target="_blank" rel="noopener noreferrer">
            www.edoeb.admin.ch
          </a>
          . Wir freuen uns, wenn du dich vorher bei uns meldest; wir suchen gerne gemeinsam eine Lösung.
        </p>
      </Sec>

      <Sec id="sicherheit">
        <p>
          Die Übertragung zwischen deinem Browser und unseren Servern erfolgt verschlüsselt per TLS (erkennbar am
          Schloss-Symbol bzw. an «https»). Passwörter werden ausschliesslich als Hash gespeichert
          {has("konto") || has("newsletter")
            ? `, Einmal-Links für Bestätigung${has("newsletter") ? " (auch die Bestätigung der Newsletter-Anmeldung)" : ""} und Passwort-Reset ebenfalls`
            : ""}
          . {has("lizenzen") ? "Lizenzschlüssel und vertrauliche" : "Vertrauliche"} Einstellungen (etwa Zugangsdaten zum
          Mailserver) liegen nur verschlüsselt in der Datenbank. Der Zugriff auf gespeicherte{" "}
          {protectedData.length > 0 ? joinList(protectedData, " und ") : "Daten"}{" "}
          ist auf berechtigte Personen beschränkt.
          {has("audit") && <> Sensible Änderungen in der Vereinsverwaltung werden protokolliert{paren("audit")}.</>} Wir
          passen unsere technischen und organisatorischen Massnahmen fortlaufend an den Stand der Technik an.
        </p>
      </Sec>

      <Sec id="aenderungen">
        <p>
          Wir passen diese Datenschutzerklärung an, wenn sich die Website, unsere Dienste oder die Rechtslage ändern. Es
          gilt jeweils die hier veröffentlichte Fassung. {stand}.
        </p>
      </Sec>
    </LegalPage>
  );
}
