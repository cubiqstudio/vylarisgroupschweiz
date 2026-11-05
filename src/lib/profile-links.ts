// Links des Konto-Menüs; ohne "use client", damit Server und Client sie nutzen können.
export type ProfileInfo = { id: string; name: string; email: string; kind: "admin" | "user"; isTeam: boolean; hasAvatar: boolean };
export type ProfileLink = { href: string; label: string; icon: "overview" | "settings" | "team" | "admin" };

export function profileLinks(p: ProfileInfo): ProfileLink[] {
  const links: ProfileLink[] = [{ href: "/account", label: "Übersicht", icon: "overview" }];
  if (p.kind === "user") links.push({ href: "/account/settings", label: "Einstellungen", icon: "settings" });
  if (p.isTeam) links.push({ href: "/account/team", label: "Team-Bereich", icon: "team" });
  if (p.kind === "admin") links.push({ href: "/admin", label: "Admin-Bereich", icon: "admin" });
  return links;
}
