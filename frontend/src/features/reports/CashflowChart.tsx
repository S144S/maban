import { useId, useState } from "react";
import { dailyRows, dateLabel, money, share, type Report } from "./model";

export function CashflowChart({ income, expense }: { income: Report; expense: Report }) {
  const titleId = useId();
  const [series, setSeries] = useState<"income" | "expense">("income");
  const label = series === "income" ? "دخل" : "خرج";
  const rows = dailyRows(income, expense);
  const max = rows.reduce((value, row) => row[series] > value ? row[series] : value, 0n);
  const rawStep = (max + 3n) / 4n;
  const unit = 10n ** BigInt(Math.max(0, rawStep.toString().length - 1));
  const step = [1n, 2n, 5n, 10n].map(value => value * unit).find(value => value >= rawStep)!;
  const axisMax = (max + step - 1n) / step * step;
  const ticks: bigint[] = [];
  for (let value = 0n; value <= axisMax; value += step) ticks.push(value);
  const left = Math.max(72, money(axisMax).length * 7 + 24);
  const plotWidth = Math.max(320, (rows.length - 1) * 32);
  const width = left + plotWidth + 24;
  const points = rows.map((row, index) => ({ ...row,
    x: left + (rows.length === 1 ? plotWidth / 2 : index * plotWidth / (rows.length - 1)),
    y: 144 - share(row[series], axisMax) * 1.2,
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const tickEvery = Math.max(1, Math.ceil(140 / (plotWidth / Math.max(1, rows.length - 1))));
  return <>
    <div className="report-ledger-tabs cashflow-switch" role="group" aria-label="نمایش نمودار دخل یا خرج">
      <button type="button" aria-pressed={series === "income"} onClick={() => setSeries("income")}>دخل</button>
      <button type="button" aria-pressed={series === "expense"} onClick={() => setSeries("expense")}>خرج</button>
    </div>
    {max === 0n ? <p className="report-empty">در این بازه {label}ی ثبت نشده.</p> : <>
      <p className="report-chart-scale">هر نقطه، جمع یک روزه. نمودار رو می‌تونین افقی جابه‌جا کنین.</p>
      <div className="cashflow-chart-scroll" dir="ltr" tabIndex={0} role="region" aria-label={`نمودار روزانهٔ ${label}؛ قابل جابه‌جایی افقی`}>
        <svg className="report-chart cashflow-chart" style={{ minWidth: width }} viewBox={`0 0 ${width} 190`} role="img" aria-labelledby={titleId}>
          <title id={titleId}>{`روند روزانهٔ ${label}؛ روزهای بدون تراکنش صفرند. مبلغ دقیق در جدول زیر نمودار در دسترسه.`}</title>
          <text x={left - 12} y="12" textAnchor="end">تومان</text>
          <line x1={left} x2={left} y1="24" y2="144" className="cashflow-axis" />
          {ticks.map(value => {
            const y = 144 - share(value, axisMax) * 1.2;
            return <g key={value.toString()} className="cashflow-axis-tick">
              <line x1={left} x2={left + plotWidth} y1={y} y2={y} className="report-gridline" />
              <text x={left - 12} y={y + 4} textAnchor="end">{money(value)}</text>
            </g>;
          })}
          <path d={path} className={`cashflow-${series}-line`} />
          {points.map((point, index) => <g key={point.date}>
            <title>{`${dateLabel(point.date)}؛ ${label} ${money(point[series])} تومان`}</title>
            {series === "income" ? <circle cx={point.x} cy={point.y} r="4" className="cashflow-income-point" /> : <rect x={point.x - 2.5} y={point.y - 2.5} width="5" height="5" className="cashflow-expense-point" />}
            {(index % tickEvery === 0 && index < points.length - Math.max(1, tickEvery / 2) || index === points.length - 1) && <text x={point.x} y="178" textAnchor={points.length === 1 ? "middle" : index === 0 ? "end" : index === points.length - 1 ? "start" : "middle"} direction="rtl">{dateLabel(point.date)}</text>}
          </g>)}
        </svg>
      </div>
      <p className="report-chart-scale">بالاترین {label} روزانه: {money(max)} تومان · پایین نمودار: صفر</p>
    </>}
    <details className="report-daily"><summary>جدول روزانه و مبلغ دقیق</summary><div className="report-table-scroll" tabIndex={0} role="region" aria-label="جدول روزانهٔ دخل و خرج"><table><caption className="sr-only">مبالغ روزانه به تومان</caption><thead><tr><th>تاریخ</th><th>دخل</th><th>خرج</th><th>خالص</th></tr></thead><tbody>{rows.map(r => <tr key={r.date}><th scope="row">{dateLabel(r.date)}</th><td><bdi>{money(r.income)}</bdi></td><td><bdi>{money(r.expense)}</bdi></td><td><bdi>{money(r.income - r.expense)}</bdi></td></tr>)}</tbody></table></div></details>
  </>;
}
