"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/account/avatar";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";

const SIZE = 256;

/** Schneidet mittig quadratisch zu, skaliert auf 256 px und kodiert als JPEG (klein, einheitlich, ohne EXIF). */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.88));
}

export function AvatarUpload({ userId, name, hasAvatar }: { userId: string; name: string; hasAvatar: boolean }) {
  const router = useRouter();
  const m = useMessages(account);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [has, setHas] = useState(hasAvatar);
  const [version, setVersion] = useState(() => Date.now());

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (!file.type.startsWith("image/")) throw new Error("type");
      const blob = await toSquareJpeg(file);
      const res = await fetch("/api/account/avatar", {
        method: "POST",
        body: blob,
        credentials: "same-origin",
        headers: { "Content-Type": "image/jpeg" },
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(j?.error?.message ?? "upload");
      }
      setHas(true);
      setVersion(Date.now());
      router.refresh();
    } catch (e) {
      const detail = e instanceof Error ? e.message : "";
      setError(detail && !["type", "canvas", "blob", "upload"].includes(detail) ? detail : m.avatar.processFailed);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/avatar", {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("delete");
      setHas(false);
      router.refresh();
    } catch {
      setError(m.avatar.removeFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar name={name} userId={userId} hasImage={has} size={88} version={version} />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="avatar-file" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {has ? m.avatar.replace : m.avatar.upload}
          </Button>
          {has && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
              <Trash2 className="size-4" aria-hidden />
              {m.avatar.remove}
            </Button>
          )}
        </div>
        <p className="text-xs text-zinc-500">{m.avatar.hint}</p>
        {error && (
          <p role="alert" className="text-xs text-rose-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
