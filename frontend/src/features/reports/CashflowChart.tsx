import { useId, useState } from "react";
import { Select } from "@/components/ui/select";
import { dailyRows, dateLabel, money, share, type Report } from "./model";

export function CashflowChart({ income, expense }: { income: Report; expense: Report }) {
  const titleId = useId();
  const [selectedDate, setSelectedDate] = useState("");
  const rows = dailyRows(income, expense);
  const size = Math.ceil(rows.length / 10);
  const buckets = Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => {
    const group = rows.slice(i * size, (i + 1) * size);
    return { start: group[0].date, end: group[group.length - 1].date, income: group.reduce((s, r) => s + r.income, 0n), expense: group.reduce((s, r) => s + r.expense, 0n) };
  });
  const max = buckets.reduce((m, r) => r.income > m ? (r.expense > r.income ? r.expense : r.income) : r.expense > m ? r.expense : m, 0n);
  const selected = buckets.find(row => row.start === selectedDate) ?? buckets[buckets.length - 1];
  return <>
    <div className="report-legend"><span><i className="report-income-key" />دخل</span><span><i className="report-expense-key" />خرج</span><small>{size === 1 ? "روزانه" : `جمع بازه‌های ${size.toLocaleString("fa-IR")} روزه`}</small></div>
    {max === 0n ? <p className="report-empty">در این بازه دخل یا خرجی ثبت نشده.</p> : <>
      <svg className="report-chart" viewBox="0 0 400 150" role="img" aria-labelledby={titleId}>
        <title id={titleId}>مقایسهٔ دخل و خرج در طول بازه؛ مبلغ دقیق در جدول زیر نمودار در دسترسه.</title>
        {[24, 64, 104, 144].map(y => <line key={y} x1="8" x2="392" y1={y} y2={y} className="report-gridline" />)}
        {buckets.map((row, i) => {
          const step = 384 / buckets.length, x = 8 + i * step, width = Math.min(13, step / 3);
          const ih = share(row.income, max) * 1.2, eh = share(row.expense, max) * 1.2;
          return <g key={row.start}><title>{dateLabel(row.start)} تا {dateLabel(row.end)}؛ دخل {money(row.income)} و خرج {money(row.expense)} تومان</title>
            <rect x={x + step / 2 - width - 1} y={144 - ih} width={width} height={ih} rx="3" className="report-income-bar" />
            <rect x={x + step / 2 + 1} y={144 - eh} width={width} height={eh} rx="0" className="report-expense-bar" />
          </g>;
        })}

      </svg>
      <div className="report-chart-dates" dir="ltr"><span>{dateLabel(income.start)}</span><span>{dateLabel(income.end)}</span></div>
      <p className="report-chart-scale">بیشترین مبلغ هر ستون: {money(max)} تومان</p>
    </>}
    {max > 0n && <div className="report-chart-inspect"><label htmlFor={`${titleId}-bucket`}>جزئیات بازه<Select id={`${titleId}-bucket`} value={selected.start} onValueChange={setSelectedDate} options={buckets.map(row => ({ value: row.start, label: row.start === row.end ? dateLabel(row.start) : `${dateLabel(row.start)} تا ${dateLabel(row.end)}` }))} /></label><p role="status">دخل: <bdi>{money(selected.income)}</bdi> تومان<br />خرج: <bdi>{money(selected.expense)}</bdi> تومان</p></div>}
    <details className="report-daily"><summary>جدول روزانه و مبلغ دقیق</summary><div className="report-table-scroll" tabIndex={0} role="region" aria-label="جدول روزانهٔ دخل و خرج"><table><caption className="sr-only">مبالغ روزانه به تومان</caption><thead><tr><th>تاریخ</th><th>دخل</th><th>خرج</th><th>خالص</th></tr></thead><tbody>{rows.map(r => <tr key={r.date}><th scope="row">{dateLabel(r.date)}</th><td><bdi>{money(r.income)}</bdi></td><td><bdi>{money(r.expense)}</bdi></td><td><bdi>{money(r.income - r.expense)}</bdi></td></tr>)}</tbody></table></div></details>
  </>;
}
