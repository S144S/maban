export type Schedule = { interval_days: number; next_due: string; status: "overdue" | "today" | "upcoming" };
export type Plant = { id: string; name: string; species: string; location: string; note: string; assignee_id: string | null; soil: Schedule; fertilizer: Schedule | null; photo_url: string | null };
export const careLabels = { watered: "آب دادم", not_needed: "هنوز نیاز به آب نداشت", fertilized: "کود دادم" };
export type CareAction = keyof typeof careLabels;
export type CareEvent = { id: string; actor_id: string; actor_name: string; action: CareAction; note: string; performed_at: string; next_due: string };
export function intervalDays(value: string): number | null {
  const digits = value.trim().replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const n = Number(digits);
  return /^\d+$/.test(digits) && n >= 1 && n <= 365 ? n : null;
}
export const formatDay = (day: string) => new Intl.DateTimeFormat("fa-IR", { dateStyle: "long", timeZone: "Asia/Tehran" }).format(new Date(`${day}T12:00:00+03:30`));
export const statusLabel = (schedule: Schedule) => schedule.status === "overdue" ? "موعدش گذشته" : schedule.status === "today" ? "نوبت امروزه" : "نوبت بعدی";
