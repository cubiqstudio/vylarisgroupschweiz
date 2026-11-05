/**
 * Gemeinsame Klassen für Banner und Dialog. Die Dunkelvariante greift über Tailwind `dark:`
 * (data-theme="dark"). Dort sind surface/ink dunkel – Schrift und Flächenakzente deshalb über helle zinc-Töne bzw. white/NN.
 */
export const consentButtonPrimary = "dark:bg-zinc-100 dark:text-ink dark:hover:bg-zinc-300";
export const consentButtonSecondary = "dark:bg-transparent dark:text-zinc-100 dark:ring-white/30 dark:hover:bg-white/10";
export const consentLink = "text-emerald-400 underline underline-offset-4 hover:text-emerald-500 dark:text-ondark-link dark:hover:text-zinc-100";
