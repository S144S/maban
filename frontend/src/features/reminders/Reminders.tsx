import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bell, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/http";
import { formatMoney, parseAmount } from "../dashboard/model";
import { formatReminderDate, parseReminderDate, reminderDateFields } from "./date";
import "./reminders.css";

const recurrenceLabels = { none: "بدون تکرار", daily: "روزانه", weekly: "هفتگی", monthly: "ماهانه" };
const recurrenceOptions = Object.entries(recurrenceLabels).map(([value, label]) => ({ value, label }));
type Reminder = { id: string; title: string; due_at: string; recurrence: keyof typeof recurrenceLabels; amount_toman: number | null; delivery_status: "not_available" };
type ReminderPage = { reminders: Reminder[]; has_more: boolean };

export function Reminders() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [deleting, setDeleting] = useState<Reminder | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const request = useRef({ payload: "", id: "" });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api<ReminderPage>(`/reminders?offset=${offset}`, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        if (offset > 0 && !result.reminders.length) { setOffset(Math.max(0, offset - 50)); return; }
        setItems(result.reminders); setHasMore(result.has_more);
      })
      .catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [offset, revision]);

  function showForm(item: Reminder | null) {
    setEditing(item); setFormError(""); setNotice("");
    request.current = { payload: "", id: "" }; setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get("title") ?? "").trim();
    const due_at = parseReminderDate(String(fields.get("date") ?? ""), String(fields.get("time") ?? ""));
    const rawAmount = String(fields.get("amount") ?? "").trim();
    const amount_toman = rawAmount ? parseAmount(rawAmount) : null;
    if (!title) { setFormError("عنوان یادآور رو وارد کنین."); return; }
    if (!due_at) { setFormError("تاریخ شمسی معتبر بین سال‌های ۱۴۰۳ تا ۱۴۹۸ و ساعت بین ۰۰:۰۰ تا ۲۳:۵۹ وارد کنین."); return; }
    if (rawAmount && amount_toman === null) { setFormError("مبلغ رو به تومان و بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ وارد کنین."); return; }
    const recurrence = String(fields.get("recurrence") ?? "none");
    const body = { title, due_at, amount_toman, recurrence };
    const payload = JSON.stringify(body);
    if (request.current.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setFormError("");
    try {
      await api(`/reminders${editing ? `/${editing.id}` : ""}`, {
        method: editing ? "PUT" : "POST", body: editing ? body : { ...body, request_id: request.current.id },
      });
      setOpen(false); setNotice("یادآور ذخیره شد. ارسال پیامک هنوز فعال نیست.");
      setOffset(0); setRevision(value => value + 1);
    } catch (err) { setFormError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }

  async function remove() {
    if (!deleting || pending.current) return;
    pending.current = true; setBusy(true); setFormError("");
    try {
      await api(`/reminders/${deleting.id}`, { method: "DELETE" });
      setDeleting(null); setNotice("یادآور حذف شد."); setRevision(value => value + 1);
    } catch (err) { setFormError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }

  const initial = editing ? reminderDateFields(editing.due_at) : { date: "", time: "09:00" };
  return <div className="management-body reminders-body">
    {loading ? <p role="status">در حال دریافت یادآورها…</p> : error ? <div role="alert"><p className="dash-error">{error}</p><Button variant="outline" onClick={() => setRevision(value => value + 1)}>تلاش دوباره</Button></div> : <>
      {items.length ? <ul className="management-list reminders-list">{items.map(item => <li key={item.id}>
        <div className="management-account-copy"><strong>{item.title}</strong><span className="reminder-date">{formatReminderDate(item.due_at)} · تهران</span>
          <span>تکرار: {recurrenceLabels[item.recurrence ?? "none"]}</span>
          {item.amount_toman !== null && <span><bdi>{formatMoney(item.amount_toman)}</bdi> تومان</span>}
        </div>
        <div className="reminder-actions"><Button variant="ghost" size="icon" aria-label={`ویرایش یادآور ${item.title}`} onClick={() => showForm(item)}><Pencil size={18} aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon" className="management-delete" aria-label={`حذف یادآور ${item.title}`} onClick={() => { setDeleting(item); setFormError(""); }}><Trash2 size={18} aria-hidden="true" /></Button></div>
      </li>)}</ul> : <div className="management-empty"><span className="management-empty-icon"><Bell size={32} aria-hidden="true" /></span><h3>اولین یادآورتون رو ثبت کنین</h3><p>مثلاً قسط وام، اجاره یا تمدید بیمه.</p></div>}
      {(offset > 0 || hasMore) && <div className="reminder-pagination"><Button variant="outline" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>قبلی</Button><Button variant="outline" disabled={!hasMore} onClick={() => setOffset(value => value + 50)}>بعدی</Button></div>}
    </>}
    <Button className="management-add" onClick={() => showForm(null)}><Plus aria-hidden="true" />افزودن یادآور</Button>
    {notice && <p className="management-notice" role="status">{notice}</p>}
    <Dialog open={open} onOpenChange={value => { if (!pending.current) setOpen(value); }}>
      <DialogContent className="management-sheet" dir="rtl" showCloseButton={!busy} onEscapeKeyDown={event => {
        if (busy || event.target instanceof Element && event.target.closest('[data-calendar-open="true"]')) event.preventDefault();
      }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>{editing ? "ویرایش یادآور" : "افزودن یادآور"}</DialogTitle><DialogDescription>موعد و تکرار یادآور رو تنظیم کنین. فعلاً این تنظیمات ذخیره می‌شن؛ اجرای خودکار و ارسال پیامک فعال نیست و مبلغ از موجودی کم نمی‌شه.</DialogDescription></DialogHeader>
        <form onSubmit={submit}><fieldset className="dash-form" disabled={busy}>
          <label htmlFor="reminder-title">عنوان یادآور<input id="reminder-title" name="title" defaultValue={editing?.title ?? ""} maxLength={80} required placeholder="مثلاً قسط وام مسکن" /></label>
          <PersianDatePicker id="reminder-date" name="date" defaultValue={initial.date} required disabled={busy} />
          <label htmlFor="reminder-time">ساعت به وقت تهران<input id="reminder-time" name="time" dir="ltr" defaultValue={initial.time} required maxLength={5} placeholder="۰۹:۰۰" aria-describedby="reminder-time-help" /></label>
          <p id="reminder-time-help" className="text-sm text-muted-foreground">ساعت ۲۴ساعته؛ مثلاً ۱۸:۳۰</p>
          <label htmlFor="reminder-recurrence">تکرار<Select id="reminder-recurrence" name="recurrence" defaultValue={editing?.recurrence ?? "none"} options={recurrenceOptions} disabled={busy} /></label>
          <label htmlFor="reminder-amount">مبلغ (تومان، اختیاری)<MoneyInput id="reminder-amount" name="amount" defaultValue={editing?.amount_toman ?? ""} maxLength={24} placeholder="مثلاً ۲٬۵۰۰٬۰۰۰" /></label>
          {formError && <p className="dash-error" role="alert">{formError}</p>}
          <Button type="submit">{busy ? "در حال ذخیره…" : "ذخیره یادآور"}</Button>
        </fieldset></form>
      </DialogContent>
    </Dialog>
    <Dialog open={!!deleting} onOpenChange={value => { if (!pending.current && !value) setDeleting(null); }}>
      <DialogContent className="management-sheet" dir="rtl" showCloseButton={!busy} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>حذف یادآور</DialogTitle><DialogDescription>یادآور «{deleting?.title}» از فهرست شما حذف می‌شه. این کار روی تراکنش‌ها و موجودی تأثیری نداره.</DialogDescription></DialogHeader>
        {formError && <p className="dash-error" role="alert">{formError}</p>}
        <Button className="management-confirm-delete" disabled={busy} onClick={() => void remove()}>{busy ? "در حال حذف…" : "حذف یادآور"}</Button>
        <Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>انصراف</Button>
      </DialogContent>
    </Dialog>
  </div>;
}
