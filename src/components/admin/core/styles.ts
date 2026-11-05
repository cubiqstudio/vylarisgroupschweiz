// Ergänzende Darstellungs-Zuordnungen für den Admin-Bereich (Werte/Labels bleiben in @/lib/constants).

export const ROLE_LABEL: Record<string, string> = {
  OWNER: "Inhaber",
  ADMIN: "Administrator",
  EDITOR: "Redakteur",
};

export const INCIDENT_SEVERITY_STYLE: Record<string, string> = {
  MINOR: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  MAJOR: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  MAINTENANCE: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30",
};

export const INCIDENT_STATUS_STYLE: Record<string, string> = {
  SCHEDULED: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30",
  INVESTIGATING: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  IDENTIFIED: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  MONITORING: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  RESOLVED: "bg-green-500/10 text-green-800 ring-green-600/30",
};

export const TICKET_STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  IN_PROGRESS: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  CLOSED: "bg-zinc-800/80 text-zinc-400 ring-zinc-700",
};

export const PILL = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

/** Open-Redirect-Schutz: nur interne /admin-Pfade zulassen. */
export function safeAdminNext(value: string | null | undefined): string {
  if (!value) return "/admin";
  if (!/^\/admin(?:[/?#]|$)/.test(value)) return "/admin";
  if (value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return "/admin";
  }
  return value;
}
