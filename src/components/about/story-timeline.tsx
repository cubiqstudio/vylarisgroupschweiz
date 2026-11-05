import { Mic, Rocket, Users, type LucideIcon } from "lucide-react";
import { about } from "@/i18n/about";
import { getMessages } from "@/i18n/server";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

type Step = {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  accent: "emerald" | "indigo";
};

const accentClass = {
  emerald: "bg-emerald-400/10 text-emerald-400 ring-emerald-400/30",
  indigo: "bg-indigo-400/10 text-indigo-300 ring-indigo-400/30",
} as const;

export async function StoryTimeline() {
  const m = (await getMessages(about)).story;
  const steps: Step[] = [
    {
      icon: Mic,
      label: m.steps.startLabel,
      title: m.steps.startTitle,
      body: m.steps.startBody,
      accent: "emerald",
    },
    {
      icon: Users,
      label: m.steps.foundingLabel,
      title: m.steps.foundingTitle,
      body: m.steps.foundingBody,
      accent: "indigo",
    },
    {
      icon: Rocket,
      label: m.steps.todayLabel,
      title: m.steps.todayTitle,
      body: m.steps.todayBody(site.members, site.board.length),
      accent: "emerald",
    },
  ];
  return (
    <ol className="relative mx-auto max-w-3xl">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const last = i === steps.length - 1;
        return (
          <li
            key={step.label}
            className={cn("relative pl-16 sm:pl-20", !last && "pb-12")}
          >
            {!last && (
              <span
                className="absolute left-6 top-14 bottom-0 w-px bg-gradient-to-b from-zinc-700 to-zinc-800 sm:left-7"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "absolute left-0 top-0 inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset sm:h-14 sm:w-14",
                accentClass[step.accent],
              )}
              aria-hidden
            >
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              <span className="sr-only">{m.step(i + 1)}</span>
              {step.label}
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {step.title}
            </h3>
            <p className="mt-3 leading-relaxed text-zinc-400">{step.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
