"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentDialog, type AccountOption, type MemberOption } from "./payment-dialog";

/** Zahlung ohne Rechnung erfassen (z. B. Spende oder Zahlung ohne Referenz). */
export function NewPaymentButton({ accounts, members }: { accounts: { assets: AccountOption[]; incomes: AccountOption[] }; members: MemberOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Zahlung ohne Rechnung erfassen
      </Button>
      <PaymentDialog open={open} onClose={() => setOpen(false)} accounts={accounts} members={members} />
    </>
  );
}
