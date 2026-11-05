import { parseReminderDate, reminderDateFields } from "@/lib/persian-date";

export type Entry = { id: string; amount_toman: number; created_at: string; title?: string; description: string | null; category_name?: string; category?: string; source?: string; location_name?: string };
export type Report = { total_toman: string; count: number; previous_total_toman: string; previous_start: string; previous_end: string; start: string; end: string; daily: { date: string; total_toman: string; count: number }[]; groups: { key: string; name: string; total_toman: string; count: number }[]; entries: Entry[]; offset: number };
export type Range = { start: string; end: string };
export const money = (value: string | bigint | number) => BigInt(value).toLocaleString("fa-IR");
export const labels: Record<string, string> = { salary: "حقوق", subsidy: "یارانه", voucher: "کالابرگ", gift: "هدیه", home: "خانه", groceries: "خرید روزمره", leisure: "تفریح", other: "سایر" };
export const dateLabel = (value: string) => new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Tehran" }).format(new Date(`${value}T12:00:00+03:30`));
export function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function presetRange(preset: string): Range {
  const solar = reminderDateFields(new Date().toISOString()).date;
  const today = parseReminderDate(solar, "12:00")!.slice(0, 10);
  if (preset === "month") return { start: parseReminderDate(solar.slice(0, 8) + "01", "12:00")!.slice(0, 10), end: today };
  return { start: shiftDay(today, preset === "week" ? -6 : -89), end: today };
}
export const share = (part: string | bigint, total: string | bigint) => BigInt(total) === 0n ? 0 : Number(BigInt(part) * 1000n / BigInt(total)) / 10;
export function change(current: string, previous: string) {
  if (BigInt(previous) === 0n) return BigInt(current) === 0n ? "۰٪ · -" : "-٪ · -";
  const delta = BigInt(current) - BigInt(previous);
  const magnitude = delta < 0n ? -delta : delta;
  const value = share(magnitude, previous);
  const percent = magnitude > 0n && value === 0 ? "کمتر از ۰٫۱" : value.toLocaleString("fa-IR");
  return delta === 0n ? "۰٪ · -" : `${percent}٪ · ${delta > 0n ? "↑" : "↓"}`;
}
export function dailyRows(income: Report, expense: Report) {
  const incoming = new Map(income.daily.map(d => [d.date, d.total_toman]));
  const outgoing = new Map(expense.daily.map(d => [d.date, d.total_toman]));
  const rows: { date: string; income: bigint; expense: bigint }[] = [];
  for (let day = income.start; day <= income.end; day = shiftDay(day, 1)) rows.push({ date: day, income: BigInt(incoming.get(day) ?? "0"), expense: BigInt(outgoing.get(day) ?? "0") });
  return rows;
}
export function downloadDaily(income: Report, expense: Report) {
  const lines = [["تاریخ", "دخل (تومان)", "خرج (تومان)", "خالص (تومان)"].join(","), ...dailyRows(income, expense).map(row => [row.date, row.income, row.expense, row.income - row.expense].join(","))];
  const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `maban-report-${income.start}-${income.end}.csv`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
