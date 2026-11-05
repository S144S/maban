import { useEffect, useState } from "react";
import { RefreshCw, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/http";
import { wealthMoney } from "./wealth-model";
import { dateLabel, type Range } from "./model";

type Day = { date: string; total_toman: string | null; unpriced_count: number };
type Wealth = {
  history_start: string | null; total_toman: string | null; unpriced_count: number; count: number;
  previous_total_toman: string | null; price_change_toman: string | null;
  holdings_change_toman: string | null; price_change_percent: string | null;
  daily: Day[]; groups: { kind: string; total_toman: string; unpriced_count: number }[];
};
const names: Record<string, string> = { gold: "طلا", silver: "نقره", stock: "سهام", crypto: "رمزارز", currency: "ارز", bond: "اوراق", house: "خانه", land: "زمین", car: "خودرو" };
const tone = (value: string | null) => value === null || Number(value) === 0 ? "neutral" : Number(value) > 0 ? "positive" : "negative";
const direction = (value: string | null) => value === null || Number(value) === 0 ? "-" : Number(value) > 0 ? "↑" : "↓";

export function WealthReport({ kind, range }: { kind: "investments" | "assets"; range: Range }) {
  const [data, setData] = useState<Wealth | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(""); setData(null);
    void api<Wealth>(`/${kind}/report?start=${range.start}&end=${range.end}`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); });
    return () => controller.abort();
  }, [kind, range.start, range.end, revision]);
  if (error) return <div className="report-state" role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div>;
  if (!data) return <p className="report-state" role="status">در حال آماده‌سازی گزارش شما…</p>;
  const title = kind === "investments" ? "سرمایه‌ها" : "دارایی‌ها";
  return <>
    <section className="report-overview" aria-label={`خلاصهٔ ${title}`}>
      <div className="report-section-head"><h2>{title}ی شما</h2><span className="wealth-private"><LockKeyhole size={14} aria-hidden="true" />شخصی</span></div>
      <div className="report-net"><span>{data.unpriced_count ? "ارزش بخش دارای نرخ" : "ارزش در پایان بازه"}</span><strong><bdi>{wealthMoney(data.total_toman)}</bdi><small>تومان</small></strong>
        {data.unpriced_count > 0 && <p>{data.unpriced_count.toLocaleString("fa-IR")} مورد نرخ نداره و در ارزش محاسبه نشده.</p>}
        {!data.history_start ? <p>با اولین ثبت در صندوق، سابقهٔ ارزش شروع می‌شه.</p> : <p>شروع سابقه: {dateLabel(data.history_start)}</p>}
      </div>
      <div className="report-kpis">
        <div className="report-kpi"><div className="report-kpi-heading">رشد یا افت ناشی از قیمت</div><div className="report-kpi-amount"><strong><bdi>{wealthMoney(data.price_change_toman)}</bdi></strong><small>تومان</small></div>
          <p className="report-kpi-change"><span className="report-change-value" data-tone={tone(data.price_change_toman)} aria-label={data.price_change_toman === null ? "دادهٔ کافی برای محاسبه نیست" : Number(data.price_change_toman) > 0 ? "رشد" : Number(data.price_change_toman) < 0 ? "افت" : "بدون تغییر"}><bdi>{data.price_change_percent === null ? "-" : Math.abs(Number(data.price_change_percent)).toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪ · {direction(data.price_change_toman)}</bdi></span><span>نسبت به ارزش ابتدای بازه</span></p>
        </div>
        <div className="report-kpi"><div className="report-kpi-heading">تغییر موجودی صندوق</div><div className="report-kpi-amount"><strong><bdi>{wealthMoney(data.holdings_change_toman)}</bdi></strong><small>تومان</small></div><p>ارزش اقلام اضافه یا کم‌شده، جدا از تغییر قیمت</p></div>
      </div>
      {data.price_change_toman === null && <p className="wealth-note">برای محاسبهٔ رشد یا افت، سابقه و نرخ کامل از ابتدای بازه لازمه.</p>}
    </section>
    <section className="report-card"><div className="report-section-head"><h2>روند ارزش {title}</h2></div><WealthChart days={data.daily} /></section>
    {data.groups.length > 0 && <section className="report-card"><div className="report-section-head"><h2>ترکیب {title}</h2></div><ul className="report-ranking">{data.groups.map(group => <li key={group.kind}><div><strong>{names[group.kind] ?? group.kind}</strong></div><p><bdi>{wealthMoney(group.total_toman)}</bdi> تومان{group.unpriced_count > 0 && <span>{group.unpriced_count.toLocaleString("fa-IR")} مورد بدون نرخ</span>}</p></li>)}</ul></section>}
    <div className="report-actions"><Button variant="ghost" onClick={() => setRevision(n => n + 1)}><RefreshCw size={18} aria-hidden="true" />به‌روزرسانی</Button></div>
  </>;
}

function WealthChart({ days }: { days: Day[] }) {
  const known = days.filter(day => day.total_toman !== null && day.unpriced_count === 0);
  const max = Math.max(0, ...known.map(day => Number(day.total_toman)));
  const min = known.length ? Math.min(...known.map(day => Number(day.total_toman))) : 0;
  const points = days.map((day, i) => ({ ...day, x: 12 + i * 296 / Math.max(1, days.length - 1), y: max === min ? 85 : 150 - (Number(day.total_toman) - min) / (max - min) * 130 }));
  return <>
    {known.length < 2 ? <p className="report-empty">برای نمایش روند، دست‌کم دو روز با نرخ کامل لازمه.</p> : <>
      <p className="report-chart-scale">بازهٔ محور ارزش: <bdi>{wealthMoney(known.reduce((a, b) => Number(a.total_toman) <= Number(b.total_toman) ? a : b).total_toman)}</bdi> تا <bdi>{wealthMoney(known.reduce((a, b) => Number(a.total_toman) >= Number(b.total_toman) ? a : b).total_toman)}</bdi> تومان</p>
      <svg className="report-chart wealth-chart" viewBox="0 0 320 170" role="img" aria-label="روند ارزش روزانه؛ روزهای بدون نرخ کامل در نمودار نمایش داده نمی‌شن. مقادیر در جدول روزانه در دسترسه.">
        {[20, 85, 150].map(y => <line key={y} x1="12" x2="308" y1={y} y2={y} className="report-gridline" />)}
        {points.map((point, i) => point.total_toman !== null && point.unpriced_count === 0 && <g key={point.date}>
          {i > 0 && points[i - 1].total_toman !== null && points[i - 1].unpriced_count === 0 && <path d={`M ${points[i - 1].x} ${points[i - 1].y} H ${point.x} V ${point.y}`} />}
          <circle cx={point.x} cy={point.y} r="2.5"><title>{dateLabel(point.date)}: {wealthMoney(point.total_toman)} تومان</title></circle>
        </g>)}
      </svg><div className="report-chart-dates" dir="ltr"><span>{dateLabel(days[0].date)}</span><span>{dateLabel(days[days.length - 1].date)}</span></div>
    </>}
    <details className="report-daily"><summary>ارزش روزانه</summary><div className="report-table-scroll" tabIndex={0} role="region" aria-label="جدول ارزش روزانه"><table><thead><tr><th scope="col">تاریخ</th><th scope="col">ارزش · تومان</th><th scope="col">وضعیت</th></tr></thead><tbody>{days.map(day => <tr key={day.date}><th scope="row">{dateLabel(day.date)}</th><td><bdi>{wealthMoney(day.total_toman)}</bdi></td><td>{day.total_toman === null ? "بدون سابقه" : day.unpriced_count > 0 ? "نرخ ناقص" : "آخرین نرخ ثبت‌شده"}</td></tr>)}</tbody></table></div></details>
  </>;
}
