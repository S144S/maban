import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, ChevronDown, MessageSquare, Pencil, Plus, Repeat2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/http";
import { formatReminderDate } from "./date";
import "./reminders.css";

import { ReminderDialog } from "./ReminderDialog";
import { recurrenceLabels, deliveryLabels, type Reminder } from "./model";
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
    setOpen(true);
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

  return <div className="management-body reminders-body">
    <Button className="management-add" onClick={() => showForm(null)}><Plus aria-hidden="true" />افزودن یادآور</Button>
    {loading ? <p role="status">در حال دریافت یادآورها…</p> : error ? <div role="alert"><p className="dash-error">{error}</p><Button variant="outline" onClick={() => setRevision(value => value + 1)}>تلاش دوباره</Button></div> : <>
      {items.length ? <ul className="reminders-list">{items.map(item => <li key={item.id}><article className="reminder-card" aria-labelledby={`reminder-${item.id}`}>
        <div className="reminder-card-header"><h2 id={`reminder-${item.id}`}>{item.title}</h2>
        <div className="reminder-actions"><Button variant="ghost" size="icon" aria-label={`ویرایش یادآور ${item.title}`} onClick={() => showForm(item)}><Pencil size={18} aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon" className="management-delete" aria-label={`حذف یادآور ${item.title}`} onClick={() => { setDeleting(item); setFormError(""); }}><Trash2 size={18} aria-hidden="true" /></Button></div>
        </div>
        <p className="reminder-date"><CalendarDays size={18} aria-hidden="true" /><span><time dateTime={item.due_at}>{formatReminderDate(item.due_at)}</time></span></p>
        <div className="reminder-meta"><span><Repeat2 size={16} aria-hidden="true" />{recurrenceLabels[item.recurrence ?? "none"]}</span></div>
        {item.note && <p className="reminder-note">{item.note}</p>}
        <details className="reminder-delivery"><summary><MessageSquare size={18} aria-hidden="true" /><span>وضعیت پیامک</span><ChevronDown size={18} aria-hidden="true" /></summary><div>
          <p>{deliveryLabels[item.delivery_status] ?? "وضعیت پیامک مشخص نیست"}</p>
          {item.next_delivery_at && <p>موعد پیامک بعدی: <time dateTime={item.next_delivery_at}>{formatReminderDate(item.next_delivery_at)}</time></p>}
        </div></details>
      </article></li>)}</ul> : <div className="management-empty"><span className="management-empty-icon"><Bell size={32} aria-hidden="true" /></span><h3>اولین یادآورتون رو ثبت کنین</h3><p>مثلاً رسیدگی به گلدون، وقت دکتر، تولد عزیزان یا پرداخت قسط.</p></div>}
      {(offset > 0 || hasMore) && <div className="reminder-pagination"><Button variant="outline" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>قبلی</Button><Button variant="outline" disabled={!hasMore} onClick={() => setOffset(value => value + 50)}>بعدی</Button></div>}
    </>}
    {notice && <p className="management-notice" role="status">{notice}</p>}
    {open && <ReminderDialog reminder={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setNotice("یادآور ذخیره شد. وضعیت پیامک رو در فهرست می‌تونین ببینین."); setOffset(0); setRevision(value => value + 1); }} />}
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
