import { useEffect, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpLeft, ChartNoAxesCombined, Download, RefreshCw, SlidersHorizontal, Wallet, ChevronLeft, ChevronRight, Users, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveFamily } from "../families/ActiveFamily";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { api, ApiError, errorMessage } from "@/lib/http";
import { parseReminderDate, reminderDateFields } from "@/lib/persian-date";
import type { Family } from "../families/api";
import { CashflowChart } from "./CashflowChart";
import { change, dateLabel, downloadDaily, labels, money, presetRange, share, type Range, type Report } from "./model";
import "./reports.css";

export function Reports() {
  const [families, setFamilies] = useState<Family[] | null>(null);
  const { selected } = useActiveFamily();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [preset, setPreset] = useState("month");
  const [range, setRange] = useState<Range>(() => presetRange("month"));
  const [custom, setCustom] = useState(false);
  const [rangeError, setRangeError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void api<{ families: Family[] }>("/families", { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setFamilies(result.families);
    }).catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); });
    return () => controller.abort();
  }, [retry]);
  const family = families?.find(f => f.id === selected) ?? families?.[0];
  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const start = parseReminderDate(String(fields.get("start")), "12:00")?.slice(0, 10);
    const end = parseReminderDate(String(fields.get("end")), "12:00")?.slice(0, 10);
    if (!start || !end || start > end || (Date.parse(end) - Date.parse(start)) / 86400000 >= 366) { setRangeError("تاریخ معتبر انتخاب کنین؛ بازه باید بین ۱ تا ۳۶۶ روز باشه."); return; }
    setRange({ start, end }); setPreset("custom"); setCustom(false); setRangeError("");
  }
  return <div className="reports">
    <div className="report-heading"><h1>گزارش مالی</h1></div>
    {error ? <div className="report-state" role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>تلاش دوباره</Button></div> : !families ? <p className="report-state" role="status">در حال دریافت خانواده‌ها…</p> : !family ? <div className="report-state"><Users size={32} aria-hidden="true" /><h2>گزارش از اولین ثبت شروع می‌شه</h2><p>یه خانواده بسازین یا به خانواده‌تون بپیوندین تا دخل‌وخرج رو اینجا ببینین.</p><Button asChild><a href="/families">رفتن به خانواده</a></Button></div> : <>
      <section className="report-filters" aria-label="فیلترهای گزارش">
        <div className="report-periods" role="group" aria-label="بازهٔ گزارش">{[{ id: "week", label: "۷ روز اخیر" }, { id: "month", label: "این ماه" }, { id: "quarter", label: "۹۰ روز اخیر" }].map(p => <button key={p.id} aria-pressed={preset === p.id} onClick={() => { setPreset(p.id); setRange(presetRange(p.id)); setCustom(false); }}>{p.label}</button>)}<button aria-expanded={custom} aria-controls="report-custom-range" aria-pressed={preset === "custom"} onClick={() => setCustom(v => !v)}><SlidersHorizontal size={16} aria-hidden="true" />دلخواه</button></div>
        {custom && <form id="report-custom-range" className="report-custom dash-form" onSubmit={applyCustom}><PersianDatePicker id="report-from" name="start" label="از تاریخ" inlineLabel required defaultValue={reminderDateFields(`${range.start}T12:00:00Z`).date} /><PersianDatePicker id="report-to" name="end" label="تا تاریخ" inlineLabel required defaultValue={reminderDateFields(`${range.end}T12:00:00Z`).date} />{rangeError && <p role="alert" className="dash-error">{rangeError}</p>}<Button type="submit">نمایش گزارش</Button></form>}
        <p className="report-range">{dateLabel(range.start)} — {dateLabel(range.end)}</p>
      </section>
      <ReportContent key={`${family.id}:${range.start}:${range.end}`} familyId={family.id} range={range} />
    </>}
  </div>;
}

function ReportContent({ familyId, range }: { familyId: string; range: Range }) {
  const [data, setData] = useState<{ income: Report; expense: Report } | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<{ key: string; report: Report } | null>(null);
  const [pageError, setPageError] = useState("");
  const [pageRetry, setPageRetry] = useState(0);
  const query = `start=${range.start}&end=${range.end}`;
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(""); setPage(0); setPageData(null);
    void Promise.all([api<Report>(`/families/${familyId}/income/report?${query}`, { signal: controller.signal }), api<Report>(`/families/${familyId}/expenses/report?${query}`, { signal: controller.signal })]).then(([income, expense]) => {
      if (!controller.signal.aborted) setData({ income, expense });
    }).catch(err => {
      if (controller.signal.aborted) return;
      if (err instanceof ApiError && err.status === 401) window.location.replace("/login");
      setError(errorMessage(err));
    });
    return () => controller.abort();
  }, [familyId, query, revision]);
  useEffect(() => {
    if (page === 0) return;
    const controller = new AbortController(); setPageError("");
    void api<Report>(`/families/${familyId}/${kind === "income" ? "income" : "expenses"}/report?${query}&offset=${page * 20}`, { signal: controller.signal }).then(report => {
      if (!controller.signal.aborted) setPageData({ key: `${kind}:${page}`, report });
    }).catch(err => { if (!controller.signal.aborted) setPageError(errorMessage(err)); });
    return () => controller.abort();
  }, [familyId, query, kind, page, pageRetry]);
  if (error) return <div className="report-state" role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div>;
  if (!data) return <div className="report-state" role="status"><ChartNoAxesCombined size={28} aria-hidden="true" /><p>در حال آماده‌سازی گزارش شما…</p></div>;
  const { income, expense } = data;
  const net = BigInt(income.total_toman) - BigInt(expense.total_toman);
  const count = income.count + expense.count;
  const selected = data[kind];
  const ledger = page === 0 ? selected : pageData?.key === `${kind}:${page}` ? pageData.report : null;
  return <>
    <section className="report-overview" aria-labelledby="report-overview-title">
      <div className="report-section-head"><h2 id="report-overview-title">خلاصهٔ این بازه</h2><span>{count.toLocaleString("fa-IR")} ثبت</span></div>
      <div className="report-net"><span><Wallet size={18} aria-hidden="true" />خالص جریان پول</span><strong><bdi>{money(net)}</bdi><small>تومان</small></strong><p>{net < 0n ? "خرج این بازه از دخل بیشتر بوده." : net > 0n ? "دخل این بازه از خرج بیشتر بوده." : "دخل و خرج این بازه برابرند."}</p></div>
      <div className="report-kpis"><div><span><ArrowDownLeft size={18} aria-hidden="true" />جمع دخل</span><strong><bdi>{money(income.total_toman)}</bdi></strong><small>تومان</small><p>{change(income.total_toman, income.previous_total_toman)}</p></div><div><span><ArrowUpLeft size={18} aria-hidden="true" />جمع خرج</span><strong><bdi>{money(expense.total_toman)}</bdi></strong><small>تومان</small><p>{change(expense.total_toman, expense.previous_total_toman)}</p></div></div>
      <p className="report-comparison">دورهٔ قبل: {dateLabel(income.previous_start)} تا {dateLabel(income.previous_end)}<br />خالص این بازه، موجودی کل حساب‌ها نیست.</p>
    </section>
    <section className="report-card" aria-labelledby="report-trend-title"><div className="report-section-head"><h2 id="report-trend-title">روند دخل و خرج</h2><ChartNoAxesCombined size={20} aria-hidden="true" /></div><CashflowChart income={income} expense={expense} /></section>
    <div className="report-breakdowns"><Breakdown report={expense} title="پول‌ها کجا خرج شده؟" empty="در این بازه خرجی ثبت نشده." /><Breakdown report={income} title="دخل از کجا بوده؟" empty="در این بازه دخلی ثبت نشده." /></div>
    <section className="report-card" aria-labelledby="report-ledger-title"><div className="report-section-head"><h2 id="report-ledger-title">ریز ثبت‌ها</h2><ReceiptText size={20} aria-hidden="true" /></div><div className="report-ledger-tabs" role="group" aria-label="نوع ثبت">{(["expense", "income"] as const).map(k => <button key={k} aria-pressed={kind === k} onClick={() => { setKind(k); setPage(0); setPageError(""); }}>{k === "expense" ? "خرج‌ها" : "دخل‌ها"}<span>{data[k].count.toLocaleString("fa-IR")}</span></button>)}</div>
      {pageError && <div role="alert"><p className="dash-error">{pageError}</p><Button variant="outline" onClick={() => setPageRetry(n => n + 1)}>تلاش دوباره</Button></div>}
      {!ledger ? <p role="status">در حال دریافت ثبت‌ها…</p> : ledger.entries.length === 0 ? <p className="report-empty">در این بازه موردی ثبت نشده.</p> : <ul className="report-ledger">{ledger.entries.map(row => <li key={row.id}><span className="report-ledger-icon">{kind === "income" ? <ArrowDownLeft size={18} aria-hidden="true" /> : <ArrowUpLeft size={18} aria-hidden="true" />}</span><div><strong>{kind === "income" ? labels[row.source ?? ""] ?? row.source : row.category_name ?? row.title}</strong><time dateTime={row.created_at}>{new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(row.created_at))}</time>{(row.description || row.location_name) && <p>{row.description || row.location_name}</p>}</div><span className="report-entry-amount"><bdi>{money(row.amount_toman)}</bdi><small>تومان</small></span></li>)}</ul>}
      {selected.count > 20 && <div className="report-pagination"><Button variant="outline" aria-label="صفحهٔ قبل" disabled={page === 0} onClick={() => { setPage(p => p - 1); setPageError(""); }}><ChevronRight size={18} /></Button><span>صفحهٔ {(page + 1).toLocaleString("fa-IR")} از {Math.ceil(selected.count / 20).toLocaleString("fa-IR")}</span><Button variant="outline" aria-label="صفحهٔ بعد" disabled={(page + 1) * 20 >= selected.count} onClick={() => { setPage(p => p + 1); setPageError(""); }}><ChevronLeft size={18} /></Button></div>}
    </section>
    <div className="report-actions"><Button variant="outline" onClick={() => downloadDaily(income, expense)}><Download size={18} aria-hidden="true" />خروجی روزانه CSV</Button><Button variant="ghost" onClick={() => setRevision(n => n + 1)}><RefreshCw size={18} aria-hidden="true" />به‌روزرسانی</Button></div>
    <p className="report-footnote">این گزارش مربوط به دخل‌وخرج خانواده‌ست؛ ارزش سرمایه‌ها و دارایی‌های شخصی در صندوق خودشون نمایش داده می‌شه.</p>
  </>;
}

function Breakdown({ report, title, empty }: { report: Report; title: string; empty: string }) {
  const [expanded, setExpanded] = useState(false);
  const groups = expanded ? report.groups : report.groups.slice(0, 5);
  return <section className="report-card"><div className="report-section-head"><h2>{title}</h2><span>{report.groups.length.toLocaleString("fa-IR")} دسته</span></div>{groups.length === 0 ? <p className="report-empty">{empty}</p> : <ul className="report-ranking">{groups.map((group, i) => {
    const percent = share(group.total_toman, report.total_toman);
    return <li key={group.key}><div><span className="report-rank">{(i + 1).toLocaleString("fa-IR")}</span><strong>{labels[group.name] ?? group.name}</strong><span>{percent.toLocaleString("fa-IR")}٪</span></div><progress value={percent} max={100} aria-label={`سهم ${labels[group.name] ?? group.name}`} /><p><bdi>{money(group.total_toman)}</bdi> تومان<span>{group.count.toLocaleString("fa-IR")} ثبت</span></p></li>;
  })}</ul>}{report.groups.length > 5 && <Button variant="ghost" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>{expanded ? "نمایش کمتر" : "همهٔ دسته‌ها"}</Button>}</section>;
}
