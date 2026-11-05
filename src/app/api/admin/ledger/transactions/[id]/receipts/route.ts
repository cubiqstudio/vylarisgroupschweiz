import { ApiError, handle, requireAdmin } from "@/lib/api";
import { addReceipt } from "@/lib/verein/ledger-data";
import { checkUpload, RECEIPT_KINDS, RECEIPT_MAX_BYTES } from "@/lib/verein/files";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Beleg hochladen (multipart, Feld «file»): PDF, PNG, JPEG oder WebP, höchstens 5 MB. Der Typ wird am Inhalt geprüft. */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const length = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > RECEIPT_MAX_BYTES + 256 * 1024) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Die Datei ist zu gross (höchstens 5 MB).");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "BAD_INPUT", "Die Datei konnte nicht gelesen werden.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "VALIDATION_ERROR", "Bitte eine Datei wählen.", { file: "Bitte eine Datei wählen." });
  const check = await checkUpload(file, { maxBytes: RECEIPT_MAX_BYTES, kinds: RECEIPT_KINDS });
  if (!check.ok) throw new ApiError(422, "VALIDATION_ERROR", check.error, { file: check.error });
  return adminOk(await addReceipt(admin, id, check), 201);
});
