"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { MEETING_KINDS, MEETING_KIND_LABEL } from "@/lib/verein/constants";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { MemberPicker, type PickedMember } from "@/components/admin/members/member-picker";

export type MeetingFormValues = {
  id: string;
  kind: string;
  title: string;
  /** Wert für <input type="datetime-local"> in Zürcher Zeit */
  startsAt: string;
  endsAt: string;
  location: string;
  leader: PickedMember | null;
  recorder: PickedMember | null;
  quorumMin: string;
  invitationText: string;
};

const EMPTY: MeetingFormValues = { id: "", kind: "MITGLIEDERVERSAMMLUNG", title: "", startsAt: "", endsAt: "", location: "", leader: null, recorder: null, quorumMin: "", invitationText: "" };

/** Sitzung anlegen oder ändern (Art, Zeit, Ort, Leitung, Protokollführung, Beschlussfähigkeit als Hinweis, Begleittext zur Einladung). */
export function MeetingForm({ initial, canWrite, kindLocked = false }: { initial?: MeetingFormValues; canWrite: boolean; kindLocked?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const edit = Boolean(initial);
  const [v, setV] = useState<MeetingFormValues>(initial ?? EMPTY);
  const [titleTouched, setTitleTouched] = useState(edit);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = <K extends keyof MeetingFormValues>(key: K, value: MeetingFormValues[K]) => {
    setV((x) => ({ ...x, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };
  const id = (k: string) => `${uid}-${k}`;

  function suggestTitle(kind: string, startsAt: string): string {
    const year = /^(\d{4})-/.exec(startsAt)?.[1];
    return `${MEETING_KIND_LABEL[kind as keyof typeof MEETING_KIND_LABEL] ?? "Sitzung"}${year ? ` ${year}` : ""}`;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !canWrite) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    const body = {
      kind: v.kind,
      title: v.title.trim(),
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      location: v.location.trim(),
      leaderId: v.leader?.id ?? "",
      recorderId: v.recorder?.id ?? "",
      quorumMin: v.quorumMin.trim() === "" ? "" : Number(v.quorumMin),
      invitationText: v.invitationText,
    };
    try {
      if (edit) {
        const res = await api<{ id: string; changedSchedule: boolean }>(`/api/admin/meetings/${encodeURIComponent(v.id)}`, { method: "PATCH", body });
        toast.success(res.changedSchedule ? "Gespeichert. Zeit oder Ort wurden nach dem Einladungsversand geändert: Informiere die Eingeladenen, z. B. mit einer Erinnerung." : "Änderungen gespeichert.");
        router.refresh();
      } else {
        const res = await api<{ id: string }>("/api/admin/meetings", { method: "POST", body });
        toast.success("Sitzung angelegt.");
        router.push(`/admin/meetings/${encodeURIComponent(res.id)}`);
        router.refresh();
      }
    } catch (err) {
      const d = describeError(err, "Die Sitzung konnte nicht gespeichert werden.");
      setErrors(d.fields);
      setFormError(d.message);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !canWrite;
  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card className="p-5 sm:p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Art der Sitzung" htmlFor={id("kind")} error={errors.kind} hint={kindLocked ? "Nach dem Einladungsversand oder der Genehmigung des Protokolls nicht mehr änderbar." : undefined}>
            <Select
              id={id("kind")}
              value={v.kind}
              disabled={disabled || kindLocked}
              onChange={(e) => {
                const kind = e.target.value;
                setV((x) => ({ ...x, kind, title: titleTouched ? x.title : suggestTitle(kind, x.startsAt) }));
              }}
            >
              {MEETING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {MEETING_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Titel" htmlFor={id("title")} error={errors.title}>
            <Input
              id={id("title")}
              value={v.title}
              disabled={disabled}
              maxLength={160}
              autoComplete="off"
              aria-invalid={Boolean(errors.title)}
              placeholder={suggestTitle(v.kind, v.startsAt)}
              onChange={(e) => {
                setTitleTouched(true);
                set("title", e.target.value);
              }}
            />
          </Field>
          <Field label="Beginn" htmlFor={id("startsAt")} error={errors.startsAt} hint="Zürcher Zeit">
            <Input
              id={id("startsAt")}
              type="datetime-local"
              value={v.startsAt}
              disabled={disabled}
              aria-invalid={Boolean(errors.startsAt)}
              onChange={(e) => {
                const startsAt = e.target.value;
                setV((x) => ({ ...x, startsAt, title: titleTouched || x.title ? x.title : suggestTitle(x.kind, startsAt) }));
                setErrors((er) => ({ ...er, startsAt: "" }));
              }}
            />
          </Field>
          <Field label="Ende (optional)" htmlFor={id("endsAt")} error={errors.endsAt}>
            <Input id={id("endsAt")} type="datetime-local" value={v.endsAt} disabled={disabled} aria-invalid={Boolean(errors.endsAt)} onChange={(e) => set("endsAt", e.target.value)} />
          </Field>
          <Field label="Ort (optional)" htmlFor={id("location")} error={errors.location} className="md:col-span-2">
            <Input id={id("location")} value={v.location} disabled={disabled} maxLength={200} autoComplete="off" onChange={(e) => set("location", e.target.value)} placeholder="Adresse oder Link zur Videokonferenz" />
          </Field>
          <MemberPicker label="Leitung (optional)" value={v.leader} onChange={(m) => set("leader", m)} disabled={disabled} error={errors.leaderId} />
          <MemberPicker label="Protokoll (optional)" value={v.recorder} onChange={(m) => set("recorder", m)} disabled={disabled} error={errors.recorderId} />
          <Field
            label="Mindestzahl anwesender Stimmberechtigter (optional)"
            htmlFor={id("quorumMin")}
            error={errors.quorumMin}
            hint="Nur als Hinweis bei der Anwesenheit. Ob die Versammlung beschlussfähig ist, richtet sich nach den Statuten; die Software sperrt nichts."
          >
            <Input id={id("quorumMin")} type="number" inputMode="numeric" min={1} max={10000} value={v.quorumMin} disabled={disabled} onChange={(e) => set("quorumMin", e.target.value)} aria-invalid={Boolean(errors.quorumMin)} />
          </Field>
          <Field label="Begleittext zur Einladung (optional)" htmlFor={id("invitationText")} error={errors.invitationText} hint="Erscheint als Text in der Einladungsmail, zusammen mit den Traktanden." className="md:col-span-2">
            <Textarea id={id("invitationText")} rows={4} maxLength={5000} value={v.invitationText} disabled={disabled} onChange={(e) => set("invitationText", e.target.value)} />
          </Field>
        </div>
      </Card>

      {formError && <Notice variant="error">{formError}</Notice>}
      {canWrite && (
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            <Save className="h-4 w-4" aria-hidden />
            {busy ? "Wird gespeichert …" : edit ? "Änderungen speichern" : "Sitzung anlegen"}
          </Button>
        </div>
      )}
    </form>
  );
}
