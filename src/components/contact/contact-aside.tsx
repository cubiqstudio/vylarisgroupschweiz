import Link from "next/link";
import { Activity, ArrowRight, EyeOff, MailCheck, MessageCircle, Server, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getMessages } from "@/i18n/server";
import { contact } from "@/i18n/contact";
import { getLegal } from "@/lib/legal";
import { site } from "@/lib/site";

function InfoCard({
  icon: Icon,
  title,
  children,
  accent = "emerald",
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: React.ReactNode;
  accent?: "emerald" | "indigo";
}) {
  return (
    <Card className="group relative overflow-hidden p-5 transition-shadow hover:shadow-md hover:shadow-slate-900/10">
      <span className={cn("absolute inset-y-0 left-0 w-1", accent === "emerald" ? "bg-emerald-400" : "bg-indigo-400")} aria-hidden />
      <div className="flex items-start gap-3.5 pl-1">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
            accent === "emerald" ? "bg-emerald-400/10 text-emerald-400 ring-emerald-400/25" : "bg-indigo-400/10 text-indigo-400 ring-indigo-400/25",
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-white">{title}</h2>
          <div className="mt-1.5 text-sm leading-relaxed text-zinc-400">{children}</div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Direkte Kontaktwege aus der Konfiguration: Telefon und E-Mail aus den Admin-Einstellungen (bzw. CONTACT_EMAIL),
 * Discord aus den Stammdaten. Was nicht hinterlegt ist, wird nicht angezeigt.
 */
async function loadChannels() {
  const legal = await getLegal().catch(() => null);
  const phone = legal?.phone;
  const digits = phone?.replace(/\D/g, "") ?? "";
  const email = legal?.email ?? site.contactEmail;
  return {
    // WhatsApp-Link nur bei einer plausiblen internationalen Nummer (E.164 hat höchstens 15 Ziffern)
    whatsapp: phone && digits.length >= 8 && digits.length <= 15 ? { label: phone, href: `https://wa.me/${digits}` } : null,
    email: email ? { label: email, href: `mailto:${email}` } : null,
    discord: site.social.discord ? { label: site.social.discord.replace(/^https?:\/\//, ""), href: site.social.discord } : null,
  };
}

export async function ContactAside() {
  const m = (await getMessages(contact)).aside;
  const channels = await loadChannels();
  const hasChannels = Boolean(channels.whatsapp || channels.email || channels.discord);
  const linkClass = "font-medium text-emerald-400 underline-offset-4 hover:text-emerald-300 hover:underline";
  return (
    <aside aria-label={m.label} className="space-y-4">
      <InfoCard icon={EyeOff} title={m.privacy.title}>
        <p>
          {m.privacy.text}{" "}
          <Link href={m.privacy.href} className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
            {m.privacy.link}
          </Link>
          .
        </p>
      </InfoCard>

      {hasChannels && (
        <InfoCard icon={MessageCircle} title={m.channels.title}>
          <p>{m.channels.text}</p>
          <ul className="mt-3 space-y-1.5">
            {channels.whatsapp && (
              <li>
                <span className="text-zinc-500">{m.channels.whatsapp}: </span>
                <a href={channels.whatsapp.href} target="_blank" rel="noopener noreferrer" aria-label={m.channels.whatsappAria} className={linkClass}>
                  {channels.whatsapp.label}
                </a>
              </li>
            )}
            {channels.email && (
              <li>
                <span className="text-zinc-500">{m.channels.email}: </span>
                <a href={channels.email.href} className={linkClass}>
                  {channels.email.label}
                </a>
              </li>
            )}
            {channels.discord && (
              <li>
                <span className="text-zinc-500">{m.channels.discord}: </span>
                <a href={channels.discord.href} target="_blank" rel="noopener noreferrer" aria-label={m.channels.discordAria} className={linkClass}>
                  {channels.discord.label}
                </a>
              </li>
            )}
          </ul>
        </InfoCard>
      )}

      <InfoCard icon={MailCheck} title={m.reply.title}>
        <p>{m.reply.text}</p>
      </InfoCard>

      <InfoCard icon={ShieldCheck} title={m.security.title} accent="indigo">
        <p>{m.security.text}</p>
      </InfoCard>

      <InfoCard icon={Server} title={m.custom.title}>
        <p>{m.custom.text}</p>
      </InfoCard>

      <InfoCard icon={Activity} title={m.status.title} accent="indigo">
        <p>{m.status.text}</p>
        <Link href="/status" className="mt-3 inline-flex items-center gap-1.5 font-medium text-emerald-400 hover:text-emerald-300">
          {m.status.link}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </InfoCard>
    </aside>
  );
}
