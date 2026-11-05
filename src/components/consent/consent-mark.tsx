/* eslint-disable @next/next/no-img-element -- kleine statische Marke, kein Bild-Optimierer nötig */
import { cn } from "@/lib/utils";

/**
 * Das „V“-Zeichen der Marke als Kachel. Banner und Dialog folgen dem gewählten Design
 * (data-theme, siehe ThemeSwitch): hell → Zeichen für helle Flächen (logo-mark-on-light) auf heller Kachel,
 * dunkel → Zeichen für dunkle Flächen (logo-mark-on-dark) auf dunkler Kachel. Der Wechsel passiert per
 * CSS (dark:-Klassen) ohne JavaScript, es gibt also kein Aufblitzen. Fehlt die Datei für helle Flächen, wird ein „V“ als Text gesetzt
 * (fehlt nur die dunkle, bleibt das helle Zeichen).
 */
export function ConsentMark({
  light,
  dark,
  className,
}: {
  /** Pfad des Zeichens für helle Flächen */
  light: string | null;
  /** Pfad des Zeichens für dunkle Flächen */
  dark: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-inset ring-zinc-800 dark:bg-white/10 dark:ring-white/20",
        className,
      )}
    >
      {light ? (
        <>
          {/* Das Zeichen folgt dem gewählten Design (data-theme), nicht der Systemvorliebe. */}
          <img src={light} alt="" className={cn("size-full object-contain p-[14%]", dark && "dark:hidden")} draggable={false} />
          {dark && <img src={dark} alt="" className="hidden size-full object-contain p-[14%] dark:block" draggable={false} />}
        </>
      ) : (
        <span className="text-lg font-bold leading-none text-emerald-400 dark:text-ondark-link">V</span>
      )}
    </span>
  );
}
