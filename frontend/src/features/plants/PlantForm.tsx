import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { parseReminderDate, reminderDateFields } from "@/lib/persian-date";
import type { Member } from "../families/api";
import { intervalDays, type Plant } from "./model";

export type PlantFields = { name: string; species: string; location: string; note: string; assignee_id: string | null; soil_interval: number; soil_due: string; fertilizer_interval: number | null; fertilizer_due: string | null };
const solarDay = (day?: string) => reminderDateFields(day ? `${day}T12:00:00+03:30` : new Date().toISOString()).date;

export function PlantForm({ plant, members, busy, error, onSubmit }: { plant: Plant | null; members: Member[]; busy: boolean; error: string; onSubmit: (fields: PlantFields) => void }) {
  const [fertilizer, setFertilizer] = useState(!!plant?.fertilizer);
  const [validation, setValidation] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const soil_interval = intervalDays(value("soil_interval"));
    const soil_due = parseReminderDate(value("soil_due"), "12:00")?.slice(0, 10);
    const fertilizer_interval = fertilizer ? intervalDays(value("fertilizer_interval")) : null;
    const fertilizer_due = fertilizer ? parseReminderDate(value("fertilizer_due"), "12:00")?.slice(0, 10) : null;
    if (!soil_interval || fertilizer && !fertilizer_interval) { setValidation("فاصلهٔ رسیدگی رو بین ۱ تا ۳۶۵ روز وارد کنین."); return; }
    if (!soil_due || fertilizer && !fertilizer_due) { setValidation("تاریخ شمسی معتبر بین سال‌های ۱۴۰۳ تا ۱۴۹۸ وارد کنین."); return; }
    setValidation("");
    onSubmit({ name: value("name"), species: value("species"), location: value("location"), note: value("note"), assignee_id: value("assignee_id") === "none" ? null : value("assignee_id"), soil_interval, soil_due, fertilizer_interval, fertilizer_due: fertilizer_due ?? null });
  }
  return <form onSubmit={submit}><fieldset className="dash-form plants-form" disabled={busy}>
    <label htmlFor="plant-name">اسم گلدون<input id="plant-name" name="name" defaultValue={plant?.name} maxLength={80} required placeholder="مثلاً پتوس کوچولو" /></label>
    <label htmlFor="plant-species">نوع گیاه (اختیاری)<input id="plant-species" name="species" defaultValue={plant?.species} maxLength={120} /></label>
    <label htmlFor="plant-location">محل قرارگیری<input id="plant-location" name="location" defaultValue={plant?.location} maxLength={120} required placeholder="مثلاً کنار پنجرهٔ پذیرایی" /></label>
    <label htmlFor="plant-assignee">مسئول رسیدگی<Select id="plant-assignee" name="assignee_id" defaultValue={plant?.assignee_id ?? "none"} disabled={busy} options={[{ value: "none", label: "همه با هم؛ بدون مسئول مشخص" }, ...members.map(m => ({ value: m.user_id, label: m.name }))]} /></label>
    <fieldset className="plants-schedule-form"><legend>برنامهٔ بررسی خاک</legend>
      <p className="dash-muted">این موعد برای بررسی خاکه؛ ممکنه هنوز نیازی به آب نباشه.</p>
      <label htmlFor="soil-interval">فاصلهٔ بررسی (روز)<input id="soil-interval" name="soil_interval" inputMode="numeric" defaultValue={plant?.soil.interval_days ?? 3} maxLength={3} required /></label>
      <PersianDatePicker id="soil-due" name="soil_due" label={plant ? "بررسی بعدی" : "اولین بررسی"} defaultValue={solarDay(plant?.soil.next_due)} required disabled={busy} />
    </fieldset>
    <label className="plants-checkbox" htmlFor="plant-fertilizer"><input type="checkbox" id="plant-fertilizer" checked={fertilizer} onChange={e => setFertilizer(e.target.checked)} />برنامهٔ کوددهی هم داشته باشه</label>
    {fertilizer && <fieldset className="plants-schedule-form"><legend>برنامهٔ کوددهی</legend>
      <label htmlFor="fertilizer-interval">فاصلهٔ کوددهی (روز)<input id="fertilizer-interval" name="fertilizer_interval" inputMode="numeric" defaultValue={plant?.fertilizer?.interval_days ?? 30} maxLength={3} required /></label>
      <PersianDatePicker id="fertilizer-due" name="fertilizer_due" label={plant ? "کوددهی بعدی" : "اولین کوددهی"} defaultValue={solarDay(plant?.fertilizer?.next_due)} required disabled={busy} />
    </fieldset>}
    <label htmlFor="plant-note">یادداشت (اختیاری)<textarea id="plant-note" name="note" defaultValue={plant?.note} maxLength={2000} rows={3} /></label>
    {(validation || error) && <p role="alert" className="dash-error">{validation || error}</p>}
    <Button type="submit">{busy ? "در حال ذخیره…" : "ذخیرهٔ گلدون"}</Button>
  </fieldset></form>;
}
