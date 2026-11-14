import { useEffect, useRef, useState, type FormEvent } from "react";
import { useActiveFamily } from "@/features/families/ActiveFamily";
import type { Family, Member } from "@/features/families/api";
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
  const { selected } = useActiveFamily();
  const [familyLoading, setFamilyLoading] = useState(true);
  const [familyError, setFamilyError] = useState("");
  const [familyRetry, setFamilyRetry] = useState(0);
  const [smsFamily, setSmsFamily] = useState(reminder?.sms_family_id ?? "");
  const resolvedFamily = useRef(reminder?.sms_family_id ?? "");
  const [recipients, setRecipients] = useState<string[]>(reminder?.recipient_user_ids ?? []);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [membersRetry, setMembersRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setMembers([]); setMembersError("");
    if (!smsFamily) { setMembersLoading(false); return () => controller.abort(); }
    setMembersLoading(true);
    Promise.all([
      api<{ members: Member[] }>(`/families/${smsFamily}`, { signal: controller.signal }),
      api<{ user: { id: string } }>("/users/me", { signal: controller.signal }),
    ]).then(([family, current]) => {
      if (!controller.signal.aborted) setMembers(family.members.filter(m => m.user_id !== current.user.id));
    }).catch(err => { if (!controller.signal.aborted) setMembersError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setMembersLoading(false); });
    return () => controller.abort();
  }, [smsFamily, membersRetry]);
  useEffect(() => {
    const controller = new AbortController();
    setFamilyLoading(true); setFamilyError("");
    api<{ families: Family[] }>("/families", { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      // Retain an existing reminder's wallet; new reminders use the active family.
      const family = result.families.find(f => f.id === reminder?.sms_family_id)
        ?? result.families.find(f => f.id === selected) ?? result.families[0];
      const familyId = family?.id ?? "";
      if (resolvedFamily.current !== familyId) setRecipients([]);
      resolvedFamily.current = familyId;
      setSmsFamily(familyId);
    }).catch(err => { if (!controller.signal.aborted) setFamilyError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setFamilyLoading(false); });
    return () => controller.abort();
  }, [familyRetry, selected, reminder?.sms_family_id]);
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const request = useRef({ payload: "", id: "" });
  const initial = reminder ? reminderDateFields(reminder.due_at) : { date: "", time: "09:00" };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || familyLoading || familyError) return;
    const fields = new FormData(event.currentTarget);
    const due_at = parseReminderDate(String(fields.get("date") ?? ""), String(fields.get("time") ?? ""));
    const note = String(fields.get("note") ?? "").trim() || null;
    if (!title.trim() || title.trim().length > 80) { setError("عنوان یادآور رو بین ۱ تا ۸۰ حرف وارد کنین."); return; }
    if (!due_at) { setError("تاریخ شروع شمسی معتبر بین سال‌های ۱۴۰۳ تا ۱۴۹۸ و ساعت بین ۰۰:۰۰ تا ۲۳:۵۹ وارد کنین."); return; }
    const body = { sms_family_id: smsFamily || null, recipient_user_ids: [...recipients].sort(), title: title.trim(), due_at, note, recurrence: String(fields.get("recurrence") ?? "none") };
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
        <DialogDescription>یادآور برای خودتون ثبت می‌شه؛ می‌تونین اعضای خانواده رو هم برای دریافت پیامک انتخاب کنین. تکرار ماهانه بر اساس ماه شمسیه.</DialogDescription></DialogHeader>
      <form onSubmit={submit}><fieldset className="dash-form reminder-form" disabled={busy}>
        <label htmlFor="reminder-title">عنوان یادآور<input id="reminder-title" name="title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={80} placeholder="مثلاً وقت دکتر یا رسیدگی به گلدون" /></label>
        <PersianDatePicker id="reminder-date" name="date" label="تاریخ شروع" defaultValue={initial.date} required disabled={busy} />
        <label htmlFor="reminder-time">ساعت به وقت تهران<input id="reminder-time" name="time" dir="ltr" defaultValue={initial.time} required maxLength={5} placeholder="۰۹:۰۰" aria-describedby="reminder-time-help" /></label>
        <p id="reminder-time-help" className="text-sm text-muted-foreground">ساعت ۲۴ساعته؛ مثلاً ۱۸:۳۰</p>
        <label htmlFor="reminder-recurrence">تکرار<Select id="reminder-recurrence" name="recurrence" defaultValue={reminder?.recurrence ?? "none"} options={recurrenceOptions} disabled={busy} /></label>
        {smsFamily && !familyLoading && !familyError && <p className="text-sm text-muted-foreground">هزینهٔ پیامک برای شما و هر عضو انتخاب‌شده، خودکار از کیف پول خانواده کم می‌شه. عنوان، موعد و مبلغ یادآور در پیامک میاد؛ یادداشت فرستاده نمی‌شه.</p>}
        {familyError && <div role="alert"><p>{familyError}</p><Button type="button" variant="outline" onClick={() => setFamilyRetry(n => n + 1)}>دریافت دوبارهٔ خانواده‌ها</Button></div>}
        <fieldset className="reminder-recipients" aria-describedby="reminder-recipients-help">
          <legend>جز خودم به کی یادآوری کنم؟</legend>
          <p id="reminder-recipients-help" className="text-sm text-muted-foreground">انتخاب اعضا اختیاریه؛ خودتون همیشه گیرندهٔ یادآور هستین.</p>
          {familyLoading ? <p role="status">در حال دریافت خانواده…</p> : familyError ? null : !smsFamily ? <p className="text-sm text-muted-foreground">برای پیامک و انتخاب اعضا، اول <a className="underline" href="/families">یه خانواده بسازین یا عضو خانواده بشین</a>. یادآور خودتون در مابان ثبت می‌شه.</p> : membersLoading ? <p role="status">در حال دریافت اعضا…</p> : membersError ? <div role="alert"><p>{membersError}</p><Button type="button" variant="outline" onClick={() => setMembersRetry(n => n + 1)}>دریافت دوبارهٔ اعضا</Button></div> : <>
            {!members.length && <p className="text-sm text-muted-foreground">هنوز عضو دیگه‌ای در این خانواده نیست.</p>}
            {members.map(member => <label className="reminder-recipient" key={member.user_id}><input type="checkbox" checked={recipients.includes(member.user_id)} onChange={e => setRecipients(ids => e.target.checked ? [...ids, member.user_id] : ids.filter(id => id !== member.user_id))} /><span>{member.name}</span></label>)}
            {recipients.filter(id => !members.some(m => m.user_id === id)).map(id => <label className="reminder-recipient" key={id}><input type="checkbox" checked onChange={() => setRecipients(ids => ids.filter(value => value !== id))} /><span>عضو قبلی؛ برای ادامه از انتخاب خارجش کنین</span></label>)}
          </>}
        </fieldset>
        <label htmlFor="reminder-note">یادداشت (اختیاری)<textarea id="reminder-note" name="note" rows={3} maxLength={2000} defaultValue={reminder?.note ?? ""} placeholder="هر توضیحی که می‌خواین یادتون بمونه…" /></label>
        {error && <p role="alert" className="dash-error">{error}</p>}
        <Button type="submit" disabled={busy || familyLoading || !!familyError}> {busy ? "در حال ذخیره…" : "ذخیره یادآور"}</Button>
      </fieldset></form>
    </DialogContent>
  </Dialog>;
}
