import Link from "next/link";
import { Activity, ArrowRight, EyeOff, MailCheck, Server, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getMessages, getSite } from "@/i18n/server";
import { contact } from "@/i18n/contact";

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

export async function ContactAside() {
  const site = await getSite();
  const m = (await getMessages(contact)).aside;
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

      <InfoCard icon={MailCheck} title={m.reply.title}>
        <p>{m.reply.text}</p>
      </InfoCard>

      <InfoCard icon={ShieldCheck} title={m.security.title} accent="indigo">
        <p>{m.security.text}</p>
      </InfoCard>

      <InfoCard icon={Server} title={m.b2b.title}>
        <p>{m.b2b.text(site)}</p>
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
