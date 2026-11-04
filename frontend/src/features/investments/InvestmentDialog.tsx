import { useRef, useState, type FormEvent } from "react";
import { TrendingUp } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api, ApiError, errorMessage } from "@/lib/http";
import { parseAmount } from "../dashboard/model";

const kinds = {
  gold: { label: "طلا", symbol: "", example: "", amount: "مقدار (گرم)", unit: "گرم", digits: 3, max: 1000000 },
  stock: { label: "سهام", symbol: "نماد سهم", example: "مثلاً فولاد", amount: "تعداد سهم", unit: "سهم", digits: 0, max: 1000000000 },
  silver: { label: "نقره", symbol: "", example: "", amount: "مقدار (گرم)", unit: "گرم", digits: 3, max: 1000000 },
  crypto: { label: "رمز ارز", symbol: "نام یا نماد رمز ارز", example: "مثلاً BTC یا بیت‌کوین", amount: "مقدار رمز ارز", unit: "واحد", digits: 18, max: 1000000000 },
  currency: { label: "ارز", symbol: "نوع ارز", example: "مثلاً دلار آمریکا یا USD", amount: "مقدار ارز", unit: "واحد ارز", digits: 2, max: 1000000000 },
  bond: { label: "اوراق قرضه", symbol: "نام یا نماد اوراق", example: "مثلاً اخزا", amount: "تعداد اوراق", unit: "ورقه", digits: 0, max: 1000000000 },
};
type Kind = keyof typeof kinds;
const currencies = [
  { value: "USD", label: "دلار" },
  { value: "EUR", label: "یورو" },
  { value: "CNY", label: "یوآن" },
  { value: "IQD", label: "دینار عراق" },
];

function parseQuantity(value: string, digits: number, max: number) {
  const normalized = value.trim().replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/٫/g, ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > digits || (digits === 0 && normalized.includes("."))) return null;
  const scaled = BigInt(whole + fraction.padEnd(digits, "0"));
  return scaled > 0n && scaled <= BigInt(max) * 10n ** BigInt(digits) ? normalized : null;
}

function parsePurchasePrice(value: string) {
  const grouped = /^[0-9۰-۹٠-٩]{1,3}(?:\.[0-9۰-۹٠-٩]{3})+$/.test(value);
  return parseAmount(grouped ? value.replace(/\./g, "") : value);
}

export function InvestmentDialog({ onSaved }: { onSaved: (message: string) => void }) {
  const [kind, setKind] = useState<Kind>("gold");
  const config = kinds[kind];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const request = useRef({ fingerprint: "", id: "" });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    const quantity = parseQuantity(String(fields.get("quantity") ?? ""), config.digits, config.max);
    const symbol = String(fields.get("symbol") ?? "").trim();
    if (!quantity || (config.symbol && !symbol)) {
      setError(`مقدار رو بیشتر از صفر و حداکثر ${config.max.toLocaleString("fa-IR")} وارد کنین${config.digits ? `؛ تا ${config.digits.toLocaleString("fa-IR")} رقم اعشار` : "، بدون اعشار"}. ${config.symbol ? "نام یا نماد رو هم وارد کنین." : ""}`); return;
    }
    const unit = String(fields.get("unit") ?? "").trim();
    const total = String(fields.get("total") ?? "").trim();
    const unitPrice = unit ? parsePurchasePrice(unit) : null;
    const totalPrice = total ? parsePurchasePrice(total) : null;
    if ((unit && unitPrice === null) || (total && totalPrice === null)) { setError("قیمت رو به تومان، بدون اعشار و بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ وارد کنین یا خالی بذارین."); return; }
    const payload = { kind, ...(kind === "gold" ? { grams: quantity, total_price_toman: totalPrice } : kind === "silver" ? { grams: quantity } : kind === "stock" ? { symbol, shares: Number(quantity) } : { symbol, quantity: kind === "bond" ? Number(quantity) : quantity }), unit_price_toman: unitPrice, description: String(fields.get("description") ?? "").trim() || null };
    const fingerprint = JSON.stringify(payload);
    if (request.current.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError("");
    try {
      await api("/investments", { method: "POST", body: { ...payload, request_id: request.current.id } });
      setOpen(false); onSaved("سرمایه‌گذاری به صندوق سرمایهٔ شما اضافه شد.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) window.location.replace("/login");
      setError(errorMessage(err));
    } finally { pending.current = false; setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => {
    if (pending.current) return;
    if (value) { setKind("gold"); setError(""); onSaved(""); request.current = { fingerprint: "", id: "" }; }
    setOpen(value);
  }}>
    <DialogTrigger asChild><Button className="home-action home-action-investment" size="lg" variant="outline"><TrendingUp aria-hidden="true" /><span>سرمایه‌گذاری</span></Button></DialogTrigger>
    <DialogContent dir="rtl" showCloseButton={!busy} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>صندوق سرمایه</DialogTitle><DialogDescription>برای خودتون ثبت می‌شه و موجودی خانواده رو تغییر نمی‌ده.</DialogDescription></DialogHeader>
      <form onSubmit={submit}><fieldset className="dash-form" disabled={busy} aria-describedby={error ? "investment-error" : undefined}>
        <label htmlFor="investment-kind">نوع سرمایه‌گذاری<Select id="investment-kind" value={kind} disabled={busy} onValueChange={value => { setKind(value as Kind); setError(""); }} options={Object.entries(kinds).map(([value, item]) => ({ value, label: item.label }))} /></label>
        <div key={kind} className="dash-form">
          {config.symbol && <label htmlFor="investment-symbol">{config.symbol}{kind === "currency" ? <Select id="investment-symbol" name="symbol" defaultValue="USD" options={currencies} required disabled={busy} /> : <input id="investment-symbol" name="symbol" required maxLength={40} placeholder={config.example} />}</label>}
          <label htmlFor="investment-quantity">{config.amount}<input id="investment-quantity" name="quantity" inputMode={config.digits ? "decimal" : "numeric"} dir="ltr" required maxLength={30} placeholder={config.digits ? "مثلاً ۲٫۵" : "مثلاً ۱۰۰"} aria-describedby="investment-quantity-hint" /></label>
          <p id="investment-quantity-hint" className="dash-small">{config.digits ? `تا ${config.digits.toLocaleString("fa-IR")} رقم اعشار می‌تونین وارد کنین.` : "تعداد رو بدون اعشار وارد کنین."}</p>
          <label htmlFor="investment-unit">قیمت خرید هر {config.unit} (اختیاری)<input id="investment-unit" name="unit" inputMode="numeric" dir="ltr" maxLength={24} placeholder="مثلاً 10.000 تومان" /></label>
        </div>
        {kind === "gold" && <label htmlFor="investment-total">قیمت کل (اختیاری)<input id="investment-total" name="total" inputMode="numeric" dir="ltr" maxLength={24} placeholder="مثلاً 100.000 تومان" /></label>}
        <label htmlFor="investment-description">توضیحات (اختیاری)<input id="investment-description" name="description" maxLength={500} /></label>
        {error && <p id="investment-error" className="dash-error" role="alert">{error}</p>}
        <Button type="submit">{busy ? "در حال ثبت…" : "ثبت سرمایه"}</Button>
      </fieldset></form>
    </DialogContent>
  </Dialog>;
}
