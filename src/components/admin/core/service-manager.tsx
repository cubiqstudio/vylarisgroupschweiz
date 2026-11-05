"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/form";
import { api, ApiClientError } from "@/lib/api-client";
import { STATUS_LABEL, type ComponentStatus } from "@/lib/constants";
import { formatUptime } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import { StatusToggle } from "./status-toggle";
import { useToast } from "./toast";
import type { ServiceDTO } from "./types";

export function ServiceManager({ initial }: { initial: ServiceDTO[] }) {
  const router = useRouter();
  const toast = useToast();
  const [services, setServices] = useState<ServiceDTO[]>(initial);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<ServiceDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => [s.name, s.slug, s.category].some((v) => v.toLowerCase().includes(q)));
  }, [services, query]);

  function setBusy(id: string, busy: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function changeStatus(service: ServiceDTO, status: ComponentStatus) {
    const previous = service.status;
    setBusy(service.id, true);
    setServices((list) => list.map((s) => (s.id === service.id ? { ...s, status } : s)));
    try {
      await api(`/api/admin/services/${service.id}`, { method: "PATCH", body: { status } });
      toast.success(`${service.name}: Status auf «${STATUS_LABEL[status]}» gesetzt.`);
      router.refresh();
    } catch (err) {
      setServices((list) => list.map((s) => (s.id === service.id ? { ...s, status: previous } : s)));
      toast.error(err instanceof ApiClientError ? err.message : "Status konnte nicht geändert werden.");
    } finally {
      setBusy(service.id, false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/api/admin/services/${toDelete.id}`, { method: "DELETE" });
      setServices((list) => list.filter((s) => s.id !== toDelete.id));
      toast.success(`«${toDelete.name}» wurde gelöscht.`);
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Service konnte nicht gelöscht werden.");
    } finally {
      setDeleting(false);
    }
  }

  if (services.length === 0) {
    return (
      <Card className="px-6 py-14 text-center">
        <p className="text-base font-medium text-white">Noch keine Services angelegt</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
          Sobald du einen Service anlegst, erscheint er auf der öffentlichen Seite «Dienste» und in der Statusübersicht.
        </p>
        <ButtonLink href="/admin/services/new" className="mt-6">
          <Plus className="h-4 w-4" aria-hidden="true" /> Ersten Service anlegen
        </ButtonLink>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Services filtern …"
            aria-label="Services filtern"
            className="pl-9"
          />
        </div>
        <p className="text-sm text-zinc-500" aria-live="polite">
          {visible.length} von {services.length} {services.length === 1 ? "Service" : "Services"}
        </p>
      </div>

      {visible.length === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-zinc-400">Kein Service passt zu «{query}».</Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-zinc-800">
            {visible.map((s) => (
              <li key={s.id} className="flex flex-col gap-4 px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/services/${s.id}`} className="truncate text-sm font-semibold text-white hover:text-emerald-300">
                      {s.name}
                    </Link>
                    {s.comingSoon && <Badge className="text-sky-300">Bald verfügbar</Badge>}
                    {s.featured && (
                      <Badge className="gap-1 text-amber-300">
                        <Star className="h-3 w-3" aria-hidden="true" /> Hervorgehoben
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>{s.category}</span>
                    <span className="font-mono">{s.slug}</span>
                    <span>Uptime {formatUptime(s.uptime)}</span>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-zinc-300"
                      >
                        Öffnen <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        <span className="sr-only">({s.name}, öffnet in neuem Tab)</span>
                      </a>
                    )}
                  </p>
                </div>

                <StatusToggle
                  label={`Status von ${s.name}`}
                  value={s.status}
                  disabled={pending.has(s.id)}
                  onChange={(next) => changeStatus(s, next)}
                  className="self-start"
                />

                <div className="flex shrink-0 items-center gap-2">
                  <ButtonLink href={`/admin/services/${s.id}`} variant="secondary" size="sm">
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Bearbeiten
                    <span className="sr-only">: {s.name}</span>
                  </ButtonLink>
                  <Button type="button" variant="danger" size="sm" onClick={() => setToDelete(s)}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Löschen
                    <span className="sr-only">: {s.name}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        danger
        busy={deleting}
        title="Service löschen?"
        description={
          toDelete
            ? `«${toDelete.name}» wird dauerhaft entfernt und verschwindet von der öffentlichen Website. Zugehörige Statusmeldungen bleiben erhalten. Das lässt sich nicht rückgängig machen.`
            : ""
        }
        confirmLabel="Endgültig löschen"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
