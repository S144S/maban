import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { Select } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/http";
import { parseReminderDate, reminderDateFields } from "@/lib/persian-date";
import { recurrenceLabels, type Reminder } from "./model";
import "./reminders.css";

const recurrenceOptions = Object.entries(recurrenceLabels).map(([value, label]) => ({ value, label }));

/** One general reminder form shared by Reminders and plant details. */
export function ReminderDialog({ reminder, onClose, onSaved }: {
  reminder?: Reminder | null; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const request = useRef({ payload: "", id: "" });
  const initial = reminder ? reminderDateFields(reminder.due_at) : { date: "", time: "09:00" };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    const due_at = parseReminderDate(String(fields.get("date") ?? ""), String(fields.get("time") ?? ""));
    const note = String(fields.get("note") ?? "").trim() || null;
    if (!title.trim() || title.trim().length > 80) { setError("عنوان یادآور رو بین ۱ تا ۸۰ حرف وارد کنین."); return; }
    if (!due_at) { setError("تاریخ شروع شمسی معتبر بین سال‌های ۱۴۰۳ تا ۱۴۹۸ و ساعت بین ۰۰:۰۰ تا ۲۳:۵۹ وارد کنین."); return; }
    const body = { title: title.trim(), due_at, note, recurrence: String(fields.get("recurrence") ?? "none") };
    const payload = JSON.stringify(body);
    if (request.current.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError("");
    try {
      await api(`/reminders${reminder ? `/${reminder.id}` : ""}`, { method: reminder ? "PUT" : "POST", body: reminder ? body : { ...body, request_id: request.current.id } });
      onSaved();
    } catch (err) { setError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !pending.current) onClose(); }}>
    <DialogContent className="management-sheet" dir="rtl" showCloseButton={!busy}
      onEscapeKeyDown={event => { if (busy || event.target instanceof Element && event.target.closest('[data-calendar-open="true"]')) event.preventDefault(); }}
      onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{reminder ? "ویرایش یادآور" : "افزودن یادآور"}</DialogTitle>
        <DialogDescription>این یادآور شخصیه. اگر ارسال پیامک فعال باشه، به شمارهٔ حساب شما فرستاده می‌شه. تکرار ماهانه بر اساس ماه شمسیه.</DialogDescription></DialogHeader>
      <form onSubmit={submit}><fieldset className="dash-form reminder-form" disabled={busy}>
        <label htmlFor="reminder-title">عنوان یادآور<input id="reminder-title" name="title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={80} placeholder="مثلاً وقت دکتر یا رسیدگی به گلدون" /></label>
        <PersianDatePicker id="reminder-date" name="date" label="تاریخ شروع" defaultValue={initial.date} required disabled={busy} />
        <label htmlFor="reminder-time">ساعت به وقت تهران<input id="reminder-time" name="time" dir="ltr" defaultValue={initial.time} required maxLength={5} placeholder="۰۹:۰۰" aria-describedby="reminder-time-help" /></label>
        <p id="reminder-time-help" className="text-sm text-muted-foreground">ساعت ۲۴ساعته؛ مثلاً ۱۸:۳۰</p>
        <label htmlFor="reminder-recurrence">تکرار<Select id="reminder-recurrence" name="recurrence" defaultValue={reminder?.recurrence ?? "none"} options={recurrenceOptions} disabled={busy} /></label>
        <label htmlFor="reminder-note">یادداشت (اختیاری)<textarea id="reminder-note" name="note" rows={3} maxLength={2000} defaultValue={reminder?.note ?? ""} placeholder="هر توضیحی که می‌خواین یادتون بمونه…" /></label>
        {error && <p role="alert" className="dash-error">{error}</p>}
        <Button type="submit" disabled={busy}> {busy ? "در حال ذخیره…" : "ذخیره یادآور"}</Button>
      </fieldset></form>
    </DialogContent>
  </Dialog>;
}
