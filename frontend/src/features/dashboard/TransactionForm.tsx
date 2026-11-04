import { Select } from "@/components/ui/select";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { categories, parseAmount, type Transaction, type Category } from "./model";

export function TransactionForm({ onSave }: { onSave: (transaction: Transaction) => void }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [errors, setErrors] = useState<Record<string, string>>({});
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const amount = parseAmount(String(data.get("amount") ?? ""));
    const next: Record<string, string> = {};
    if (!title) next.title = "عنوان تراکنش رو وارد کنین.";
    if (amount === null) next.amount = "مبلغ صحیح بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ تومان وارد کنین.";
    setErrors(next);
    if (Object.keys(next).length) { (form.elements.namedItem(Object.keys(next)[0]) as HTMLInputElement)?.focus(); return; }
    onSave({ id: crypto.randomUUID(), title, amount: amount!, kind, category: String(data.get("category") ?? "home") as Category, date: "ثبت جدید · مهر" });
  }
  return <form className="dash-form" onSubmit={submit} noValidate>
    <div className="dash-segments" role="group" aria-label="نوع تراکنش">
      <Button type="button" variant={kind === "expense" ? "default" : "outline"} aria-pressed={kind === "expense"} onClick={() => setKind("expense")}>هزینه</Button>
      <Button type="button" variant={kind === "income" ? "default" : "outline"} aria-pressed={kind === "income"} onClick={() => setKind("income")}>درآمد</Button>
    </div>
    <div><label htmlFor="transaction-title">عنوان<input id="transaction-title" name="title" maxLength={80} required aria-invalid={!!errors.title} aria-describedby={errors.title ? "title-error" : undefined} onChange={() => setErrors(current => ({ ...current, title: "" }))} /></label>{errors.title && <p className="dash-error" id="title-error">{errors.title}</p>}</div>
    <div><label htmlFor="transaction-amount">مبلغ (تومان)<input id="transaction-amount" name="amount" inputMode="numeric" dir="ltr" required aria-invalid={!!errors.amount} aria-describedby={errors.amount ? "amount-error" : undefined} onChange={() => setErrors(current => ({ ...current, amount: "" }))} /></label>{errors.amount && <p className="dash-error" id="amount-error">{errors.amount}</p>}</div>
    {kind === "expense" && <label htmlFor="transaction-category">دسته‌بندی<Select id="transaction-category" name="category" defaultValue="groceries" options={categories.map(c => ({ value: c.id, label: c.title }))} /></label>}
    <Button size="lg" type="submit">ثبت {kind === "expense" ? "هزینه" : "درآمد"}</Button>
  </form>;
}
