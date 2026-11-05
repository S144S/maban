import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { api, errorMessage } from "@/lib/http";
import { parseAmount } from "../dashboard/model";
import "./rates.css";

const kinds = {
  gold: { label: "طلا", unit: "گرم" }, silver: { label: "نقره", unit: "گرم" },
  stock: { label: "سهم", unit: "واحد سهم" }, crypto: { label: "رمز ارز", unit: "واحد" },
  currency: { label: "ارز", unit: "واحد" }, bond: { label: "اوراق", unit: "ورقه" },
};
type InvestmentRate = { kind: keyof typeof kinds; symbol: string; unit_price_toman: number | null };
type AssetRate = { id: string; kind: "house" | "land" | "car"; title: string | null; location: string | null; brand: string | null; model: string | null; manufacture_year: number | null; unit_price_toman: number | null };
type Rate = { key: string; label: string; unit: string; unit_price_toman: number | null; path: string; identity: object; metal?: boolean };
async function loadRates(signal: AbortSignal): Promise<Rate[]> {
  const [investments, assets] = await Promise.all([
    api<{ entries: InvestmentRate[] }>("/investments/rates", { signal }),
    api<{ entries: AssetRate[] }>("/assets/rates", { signal }),
  ]);
  return [
    ...investments.entries.map(rate => ({
      key: `${rate.kind}:${rate.symbol}`,
      label: rate.kind === "gold" ? "نرخ روز هر گرم طلا" : rate.kind === "stock" ? `نرخ هر واحد سهم از ${rate.symbol}` : `نرخ هر ${kinds[rate.kind].unit} ${rate.symbol || kinds[rate.kind].label}`,
      unit: kinds[rate.kind].unit, unit_price_toman: rate.unit_price_toman,
      path: "/investments/rates", identity: { kind: rate.kind, symbol: rate.symbol },
      metal: rate.kind === "gold" || rate.kind === "silver",
    })),
    ...assets.entries.map(rate => ({
      key: rate.id,
      label: rate.kind === "car" ? `قیمت روز خودرو ${[rate.brand, rate.model, rate.manufacture_year?.toLocaleString("fa-IR", { useGrouping: false })].filter(Boolean).join(" ")}` : `نرخ هر مترمربع ${rate.kind === "land" ? "زمین" : "خانه"} واقع در ${rate.location} (${rate.title})`,
      unit: rate.kind === "car" ? "خودرو" : "مترمربع", unit_price_toman: rate.unit_price_toman,
      path: `/assets/rates/${rate.id}`, identity: {},
    })),
  ];
}

function RateRow({ rate }: { rate: Rate }) {
  const id = useId();
  const saved = useRef(rate.unit_price_toman);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function save(raw: string) {
    if (pending.current) return;
    const price = raw.trim() === "" ? null : parseAmount(raw);
    if (raw.trim() !== "" && price === null) {
      setError("نرخ رو از ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ تومان وارد کنین.");
      return;
    }
    if (price === saved.current) { setError(""); return; }
    pending.current = true;
    setBusy(true); setError(""); setStatus("در حال ذخیره…");
    try {
      await api(rate.path, { method: "PUT", body: { ...rate.identity, unit_price_toman: price } });
      saved.current = price;
      setStatus(price === null ? "نرخ پاک شد" : "ذخیره شد");
    } catch (err) { setError(errorMessage(err)); setStatus(""); }
    finally { pending.current = false; setBusy(false); }
  }

  return <li className="rate-row">
    <label className="rate-label" htmlFor={id}>{rate.label}</label>
    <div className="rate-price">
      <MoneyInput id={id} defaultValue={rate.unit_price_toman ?? ""} placeholder="—"
        readOnly={busy} aria-busy={busy} aria-invalid={!!error}
        aria-describedby={`${id}-feedback${rate.metal ? ` ${id}-hint` : ""}`}
        onChange={() => { setError(""); setStatus(""); }}
        onBlur={event => { void save(event.currentTarget.value); }}
        onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void save(event.currentTarget.value); } }} />
      <span>تومان</span>
    </div>
    {rate.metal && <span id={`${id}-hint`} className="sr-only">نرخ هر گرم متناسب با عیار؛ برای همهٔ سرمایه‌های هم‌نوع استفاده می‌شه.</span>}
    <p id={`${id}-feedback`} className={`rate-feedback${error ? " rate-error" : ""}`} role={error ? "alert" : "status"}>{error || status}</p>
  </li>;
}

export function InvestmentRates() {
  const [data, setData] = useState<Rate[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void loadRates(controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); });
    return () => controller.abort();
  }, [revision]);
  if (error) return <div className="management-body" role="alert"><p className="dash-error">{error}</p><Button variant="outline" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div>;
  if (!data) return <p className="management-body" role="status">در حال دریافت نرخ‌نامه…</p>;
  return <div className="management-body investment-rates">
    {data.length ? <>
      <ul className="rates-list">{data.map(rate => <RateRow key={rate.key} rate={rate} />)}</ul>
    </> : <p className="management-empty">اول سرمایه یا دارایی‌تون رو به صندوق اضافه کنین تا نرخش رو اینجا ثبت کنین.</p>}
  </div>;
}
