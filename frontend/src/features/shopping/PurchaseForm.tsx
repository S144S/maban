import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { CategoryField } from "../expenses/CategoryField";
import { parseAmount } from "../dashboard/model";

export type PurchaseCost = { amount_toman?: number; category_id?: string };

export function PurchaseForm({ familyId, itemName, hasExpense, disabled, busy, onCancel, onSave }: {
  familyId: string; itemName: string; hasExpense: boolean; disabled: boolean; busy: boolean;
  onCancel: () => void; onSave: (cost: PurchaseCost) => void;
}) {
  const [withAmount, setWithAmount] = useState(false);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const raw = String(fields.get("amount") ?? "").trim();
    if (hasExpense || !raw) { setError(""); onSave({}); return; }
    const amount = parseAmount(raw);
    if (amount === null) { setError("مبلغ رو به تومان و بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ وارد کنین."); return; }
    setError("");
    const category = String(fields.get("category_id") ?? "");
    onSave({ amount_toman: amount, ...(category ? { category_id: category } : {}) });
  }
  return <form className="dash-form shopping-checkout" onSubmit={submit}>
    {hasExpense ? <p className="shopping-cost-hint">برای این لیست قبلاً خرج ثبت شده. برای جلوگیری از ثبت تکراری، لیست بدون هزینهٔ تازه تکمیل می‌شه.</p> : <>
      <label htmlFor="shopping-amount"><span>هزینه خرید {itemName.trim() ? <>لیست <bdi>{itemName.trim()}</bdi></> : "این لیست"} (اختیاری)</span>
        <MoneyInput id="shopping-amount" name="amount" disabled={disabled} aria-invalid={!!error}
          autoComplete="off" placeholder="مثلا 150.000 تومان"
          onChange={event => { setWithAmount(!!event.currentTarget.value.trim()); setError(""); }} />
      </label>
      <CategoryField familyId={familyId} disabled={disabled} optional />
    </>}
    {error && <p role="alert" className="dash-error">{error}</p>}
    <div className="shopping-dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>انصراف</Button>
      <Button type="submit" disabled={disabled}>{busy ? "در حال ثبت…" : withAmount && !hasExpense ? "تکمیل لیست و ثبت خرج" : "تکمیل لیست"}</Button></div>
  </form>;
}
