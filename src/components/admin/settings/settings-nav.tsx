const ITEMS = [
  { href: "#rechtliches", label: "Rechtliches" },
  { href: "#email", label: "E-Mail (SMTP)" },
  { href: "#registrierung", label: "Registrierung" },
];

export function SettingsNav() {
  return (
    <nav aria-label="Abschnitte der Einstellungen" className="-mx-1 mb-6 overflow-x-auto px-1 pb-1">
      <ul className="flex min-w-max gap-1.5">
        {ITEMS.map((i) => (
          <li key={i.href}>
            <a
              href={i.href}
              className="inline-flex h-9 items-center rounded-lg bg-zinc-900/50 px-3 text-sm font-medium text-zinc-400 ring-1 ring-inset ring-zinc-800 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
