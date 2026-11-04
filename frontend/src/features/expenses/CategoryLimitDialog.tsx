import { useRef, useState, type FormEvent } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/http";
import { parseAmount, formatMoney } from "../dashboard/model";
import type { ExpenseCategory } from "./CategoryField";

export function CategoryLimitDialog({ familyId, category, onSaved }: {
  familyId: string; category: ExpenseCategory; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  async function save(value: number | null) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await api(`/families/${familyId}/expenses/categories/${category.id}/monthly-limit`, {
        method: "PUT", body: { monthly_limit_toman: value },
      });
      setOpen(false); setNotice(value === null ? "حد ماهانه برداشته شد." : "حد ماهانه ذخیره شد."); onSaved();
    } catch (err) { setError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get("limit") ?? "").trim();
    const amount = raw ? parseAmount(raw) : null;
    if (raw && amount === null) { setError("حد خرج رو به تومان و بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ وارد کنین."); return; }
    void save(amount);
  }
  return <>
    <Dialog open={open} onOpenChange={value => { if (!pending.current) { setOpen(value); setError(""); } }}>
      <DialogTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={`تنظیمات ${category.name}`}>
        <Settings size={18} aria-hidden="true" />
      </Button></DialogTrigger>
      <DialogContent className="management-sheet" dir="rtl" showCloseButton={!busy}
        onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
        onInteractOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>تنظیمات {category.name}</DialogTitle>
          <DialogDescription>این حد برای مجموع خرج‌های خانواده در این دسته‌بندی و برای هر ماه شمسی تکرار می‌شه. فعلاً هشدار ارسال نمی‌شه و ثبت خرج محدود نمی‌شه.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}><fieldset className="dash-form" disabled={busy}>
          <label htmlFor="category-monthly-limit">حد خرج ماهانه (تومان)<input id="category-monthly-limit" name="limit" inputMode="numeric" dir="ltr" maxLength={24}
            defaultValue={category.monthly_limit_toman == null ? "" : formatMoney(category.monthly_limit_toman)} placeholder="مثلاً ۵٬۰۰۰٬۰۰۰" aria-describedby="category-limit-help" /></label>
          <p id="category-limit-help" className="text-sm text-muted-foreground">برای نداشتن حد ماهانه، این کادر رو خالی بذارین.</p>
          {error && <p className="dash-error" role="alert">{error}</p>}
          <Button type="submit">{busy ? "در حال ذخیره…" : "ذخیره حد ماهانه"}</Button>
          {category.monthly_limit_toman != null && <Button type="button" variant="outline" onClick={() => void save(null)}>برداشتن حد ماهانه</Button>}
        </fieldset></form>
      </DialogContent>
    </Dialog>
    {notice && <span className="sr-only" role="status">{notice}</span>}
  </>;
}
