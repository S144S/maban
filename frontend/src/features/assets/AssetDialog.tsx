import { useRef, useState, type FormEvent } from "react";
import { Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api, ApiError, errorMessage } from "@/lib/http";
import { parseAmount } from "../dashboard/model";

const kinds = [{ value: "house", label: "خانه" }, { value: "car", label: "خودرو" }, { value: "land", label: "زمین" }];
const digits = (value: string) => value.trim().replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/٫/g, ".");

export function AssetDialog({ onSaved }: { onSaved: (message: string) => void }) {
  const [kind, setKind] = useState("house");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const request = useRef({ fingerprint: "", id: "" });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    const text = (name: string) => String(fields.get(name) ?? "").trim();
    let details: Record<string, unknown>;
    if (kind === "car") {
      const year = digits(text("year"));
      const [min, max] = [1200, 1500];
      if (!text("model")) { setError("مدل خودرو رو وارد کنین."); return; }
      if (!/^\d{4}$/.test(year) || Number(year) < min || Number(year) > max) {
        setError(`سال ساخت شمسی رو بین ${min.toLocaleString("fa-IR", {useGrouping: false})} و ${max.toLocaleString("fa-IR", {useGrouping: false})} وارد کنین.`); return;
      }
      details = { model: text("model"), manufacture_year: Number(year), year_calendar: "solar" };
    } else {
      const area = digits(text("area"));
      if (!text("title") || !text("location")) { setError("عنوان و موقعیت ملک رو وارد کنین."); return; }
      if (!/^\d+(?:\.\d{1,2})?$/.test(area) || Number(area) <= 0 || Number(area) > 1000000000) {
        setError("مساحت رو بیشتر از صفر و حداکثر ۱٬۰۰۰٬۰۰۰٬۰۰۰ مترمربع، با حداکثر دو رقم اعشار وارد کنین."); return;
      }
      details = { title: text("title"), location: text("location"), area_sqm: area };
    }
    const priceText = digits(text("price"));
    const price = priceText ? parseAmount(/^\d{1,3}(?:\.\d{3})+$/.test(priceText) ? priceText.replace(/\./g, "") : priceText) : null;
    if (priceText && price === null) { setError("قیمت خرید رو به تومان، بدون اعشار و بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ وارد کنین یا خالی بذارین."); return; }
    const payload = { kind, ...details, ...(kind === "car" ? { purchase_price_toman: price } : { price_per_sqm_toman: price }), description: text("description") || null };
    const fingerprint = JSON.stringify(payload);
    if (request.current.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError("");
    try {
      await api("/assets", { method: "POST", body: { ...payload, request_id: request.current.id } });
      setOpen(false); onSaved("دارایی به صندوق شما اضافه شد.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) window.location.replace("/login");
      setError(errorMessage(err));
    } finally { pending.current = false; setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => {
    if (pending.current) return;
    if (value) { setKind("house"); setError(""); onSaved(""); request.current = { fingerprint: "", id: "" }; }
    setOpen(value);
  }}>
    <DialogTrigger asChild><Button className="home-action home-action-assets" size="lg" variant="outline"><Gem aria-hidden="true" /><span>دارایی‌ها</span></Button></DialogTrigger>
    <DialogContent dir="rtl" showCloseButton={!busy} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>صندوق دارایی</DialogTitle><DialogDescription>برای خودتون ثبت می‌شه و موجودی خانواده رو تغییر نمی‌ده.</DialogDescription></DialogHeader>
      <form onSubmit={submit}><fieldset className="dash-form" disabled={busy} aria-describedby={error ? "asset-error" : undefined}>
        <label htmlFor="asset-kind">نوع دارایی<Select id="asset-kind" value={kind} options={kinds} disabled={busy} onValueChange={value => { setKind(value); setError(""); }} /></label>
        <div key={kind} className="dash-form">
          {kind === "car" ? <>
            <label htmlFor="asset-model">مدل<input id="asset-model" name="model" maxLength={80} required placeholder="مثلاً پژو 206 SD" /></label>
            <label htmlFor="asset-year">سال ساخت (شمسی)<input id="asset-year" name="year" inputMode="numeric" dir="ltr" required maxLength={4} /></label>
          </> : <>
            <label htmlFor="asset-title">عنوان {kind === "house" ? "خانه" : "زمین"}<input id="asset-title" name="title" maxLength={80} required placeholder={kind === "house" ? "مثلاً آپارتمان محل سکونت" : "مثلاً زمین باغ"} /></label>
            <label htmlFor="asset-location">موقعیت ملک<input id="asset-location" name="location" maxLength={200} required placeholder="شهر و محله یا محدوده" /></label>
            <label htmlFor="asset-area">مساحت (مترمربع)<input id="asset-area" name="area" inputMode="decimal" dir="ltr" required maxLength={16} placeholder="مثلاً ۸۵٫۵" aria-describedby="asset-area-hint" /></label>
            <p id="asset-area-hint" className="dash-small">تا دو رقم اعشار می‌تونین وارد کنین.</p>
          </>}
          <label htmlFor="asset-price">{kind === "car" ? "قیمت خرید (اختیاری)" : "قیمت هر متر مربع (اختیاری)"}<input id="asset-price" name="price" inputMode="numeric" dir="ltr" maxLength={24} placeholder={kind === "car" ? "مثلاً 1.000.000.000 تومان" : "مثلاً 100.000.000 تومان"} /></label>
        </div>
        <label htmlFor="asset-description">توضیحات (اختیاری)<input id="asset-description" name="description" maxLength={500} /></label>
        {error && <p id="asset-error" className="dash-error" role="alert">{error}</p>}
        <Button type="submit">{busy ? "در حال ثبت…" : "ثبت دارایی"}</Button>
      </fieldset></form>
    </DialogContent>
  </Dialog>;
}
