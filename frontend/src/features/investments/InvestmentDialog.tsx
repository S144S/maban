import { useRef, useState, type FormEvent } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api, ApiError, errorMessage } from "@/lib/http";
import { parseAmount } from "../dashboard/model";

function parseGrams(value: string) {
  const normalized = value.trim().replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/٫/g, ".");
  return /^\d+(?:\.\d{1,3})?$/.test(normalized) && Number(normalized) > 0 && Number(normalized) <= 1000000 ? normalized : null;
}

function parsePurchasePrice(value: string) {
  const grouped = /^[0-9۰-۹٠-٩]{1,3}(?:\.[0-9۰-۹٠-٩]{3})+$/.test(value);
  return parseAmount(grouped ? value.replace(/\./g, "") : value);
}

export function InvestmentDialog({ onSaved }: { onSaved: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const request = useRef({ fingerprint: "", id: "" });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    const grams = parseGrams(String(fields.get("grams") ?? ""));
    if (!grams) { setError("مقدار طلا رو بیشتر از صفر و حداکثر ۱٬۰۰۰٬۰۰۰ گرم، با حداکثر سه رقم اعشار وارد کنین."); return; }
    const unit = String(fields.get("unit") ?? "").trim();
    const total = String(fields.get("total") ?? "").trim();
    const unitPrice = unit ? parsePurchasePrice(unit) : null;
    const totalPrice = total ? parsePurchasePrice(total) : null;
    if ((unit && unitPrice === null) || (total && totalPrice === null)) { setError("قیمت رو به تومان، بدون اعشار و بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ وارد کنین یا خالی بذارین."); return; }
    const payload = { kind: "gold", grams, unit_price_toman: unitPrice, total_price_toman: totalPrice, description: String(fields.get("description") ?? "").trim() || null };
    const fingerprint = JSON.stringify(payload);
    if (request.current.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError("");
    try {
      await api("/investments", { method: "POST", body: { ...payload, request_id: request.current.id } });
      setOpen(false); onSaved("طلا به صندوق سرمایهٔ شما اضافه شد.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) window.location.replace("/login");
      setError(errorMessage(err));
    } finally { pending.current = false; setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => {
    if (pending.current) return;
    if (value) { setError(""); onSaved(""); request.current = { fingerprint: "", id: "" }; }
    setOpen(value);
  }}>
    <DialogTrigger asChild><Button className="home-action home-action-investment" size="lg" variant="outline"><TrendingUp aria-hidden="true" /><span>سرمایه‌گذاری</span></Button></DialogTrigger>
    <DialogContent dir="rtl" showCloseButton={!busy} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>صندوق سرمایه</DialogTitle><DialogDescription>برای خودتون ثبت می‌شه و موجودی خانواده رو تغییر نمی‌ده.</DialogDescription></DialogHeader>
      <form onSubmit={submit}><fieldset className="dash-form" disabled={busy} aria-describedby={error ? "investment-error" : undefined}>
        <label htmlFor="investment-kind">نوع سرمایه‌گذاری<input id="investment-kind" value="طلا" readOnly tabIndex={-1} /></label>
        <label htmlFor="investment-grams">مقدار (گرم)<input id="investment-grams" name="grams" inputMode="decimal" dir="ltr" required maxLength={16} placeholder="مثلاً ۲٫۵" aria-describedby="investment-grams-hint" /></label>
        <p id="investment-grams-hint" className="dash-small">تا سه رقم اعشار می‌تونین وارد کنین.</p>
        <label htmlFor="investment-unit">قیمت خرید هر گرم (اختیاری)<input id="investment-unit" name="unit" inputMode="numeric" dir="ltr" maxLength={24} placeholder="مثلاً 10.000 تومان" /></label>
        <label htmlFor="investment-total">قیمت کل (اختیاری)<input id="investment-total" name="total" inputMode="numeric" dir="ltr" maxLength={24} placeholder="مثلاً 100.000 تومان" /></label>
        <label htmlFor="investment-description">توضیحات (اختیاری)<input id="investment-description" name="description" maxLength={500} /></label>
        {error && <p id="investment-error" className="dash-error" role="alert">{error}</p>}
        <Button type="submit">{busy ? "در حال ثبت…" : "ثبت سرمایه"}</Button>
      </fieldset></form>
    </DialogContent>
  </Dialog>;
}
