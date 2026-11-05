"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";

/** Vollzieht alle fälligen Austritte auf einen Schlag (nach Bestätigung). */
export function DueExitsButton({ count }: { count: number }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api<{ count: number }>("/api/admin/members/exits", { method: "POST" });
      toast.success(res.count === 1 ? "Ein Austritt wurde vollzogen." : `${res.count} Austritte wurden vollzogen.`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Die Austritte konnten nicht vollzogen werden.").message);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Fällige Austritte vollziehen ({count})
      </Button>
      <ConfirmDialog
        open={open}
        title="Fällige Austritte vollziehen?"
        description={`${count === 1 ? "Ein Mitglied hat" : `${count} Mitglieder haben`} den Austrittstermin überschritten. Sie werden als ausgetreten geführt und erhalten keine Beiträge und Einladungen mehr.`}
        confirmLabel="Austritte vollziehen"
        busy={busy}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
