import { LocationField } from "../money-locations/LocationField";
import { Select } from "@/components/ui/select";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Inbox, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/http";
import type { Member } from "../families/api";
import "./income.css";

const sources = { salary: "حقوق", subsidy: "یارانه", voucher: "کالابرگ", gift: "هدیه" };
type Entry = { id: string; amount_toman: number; source: keyof typeof sources; from_member_name: string; location_name: string | null; description: string | null; created_at: string };
type Listing = { entries: Entry[]; total_toman: string; count: number };
const money = (value: string | number) => BigInt(value).toLocaleString("fa-IR");
function amountOf(value: string) {
  const normalized = value.replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[,٬\s]/g, "");
  return /^\d+$/.test(normalized) ? Number(normalized) : NaN;
}
export function IncomeInbox({ familyId, members, canWrite, userId }: { familyId: string; members: Member[]; canWrite: boolean; userId: string }) {
  const [data, setData] = useState<Listing | null>(null);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const request = useRef({ fingerprint: "", id: "" });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api<Listing>(`/families/${familyId}/income?offset=${offset}`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [familyId, offset, revision]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = new FormData(event.currentTarget);
    const amount = amountOf(String(form.get("amount")));
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1e12) { setFormError("مبلغ رو به تومان، عدد صحیح و بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ وارد کنین."); return; }
    if (!form.get("location")) { setFormError("حساب مقصد رو انتخاب کنین."); return; }
    const payload = { amount_toman: amount, source: form.get("source"), location_id: form.get("location"), from_member_id: form.get("member"), description: String(form.get("description")).trim() || null };
    const fingerprint = JSON.stringify(payload);
    if (request.current.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setFormError("");
    try {
      await api(`/families/${familyId}/income`, { method: "POST", body: { ...payload, request_id: request.current.id } });
      setOpen(false); setNotice("درآمد به صندوق خانواده اضافه شد."); setOffset(0); setRevision(n => n + 1);
    } catch (err) { setFormError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="account-card income-inbox" aria-label="صندوق درآمد خانواده">
    <div className="family-section-heading"><h2><Inbox size={22} aria-hidden="true" /> صندوق درآمد</h2><span className="family-private"><ShieldCheck size={16} aria-hidden="true" />مشترک با خانواده</span></div>
    <p className="auth-hint">حقوق، یارانه، کالابرگ و هدیه‌های خانواده، یک‌جا.</p>
    {data && !error && <div className="income-total"><span>جمع ورودی‌ها</span><strong>{money(data.total_toman)} <small>تومان</small></strong><span>{data.count.toLocaleString("fa-IR")} ورودی</span></div>}
    {canWrite ? <Button onClick={() => { request.current = { fingerprint: "", id: "" }; setFormError(""); setNotice(""); setOpen(true); }}><Plus size={18} aria-hidden="true" />ثبت درآمد</Button> : <p className="auth-hint">دسترسی شما «فقط دیدن» است.</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">در حال دریافت ورودی‌ها…</p> : error ? <div role="alert"><p className="auth-error">{error}</p><Button variant="outline" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div> : data && <>
      {!data.count ? <p className="income-empty">هنوز درآمدی ثبت نشده؛ ورودی‌های خانواده رو اینجا نگه دارین.</p> : <ul className="income-list">{data.entries.map(entry => <li key={entry.id}><div className="income-row"><strong>{sources[entry.source]}</strong><strong>{money(entry.amount_toman)} <small>تومان</small></strong></div><p>از جانب {entry.from_member_name}</p><p>واریز به: {entry.location_name ?? "مشخص نشده"}</p>{entry.description && <p className="income-description">{entry.description}</p>}<time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleDateString("fa-IR")}</time></li>)}</ul>}
      {(offset > 0 || offset + 50 < data.count) && <div className="income-pagination"><Button variant="outline" disabled={offset === 0} onClick={() => setOffset(n => Math.max(0, n - 50))}>جدیدتر</Button><Button variant="outline" disabled={offset + 50 >= data.count} onClick={() => setOffset(n => n + 50)}>قدیمی‌تر</Button></div>}
    </>}
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="family-sheet" dir="rtl" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>ثبت درآمد خانواده</DialogTitle><DialogDescription>مبلغ رو به تومان وارد کنین. این ورودی برای اعضای خانواده نمایش داده می‌شه.</DialogDescription></DialogHeader>
      <form className="auth-form" onSubmit={submit}><fieldset className="auth-fields" disabled={busy}>
        <div className="auth-field"><label htmlFor="income-amount">مبلغ (تومان)</label><input id="income-amount" name="amount" inputMode="numeric" dir="ltr" required maxLength={24} placeholder="مثلاً ۱۵٬۰۰۰٬۰۰۰" /></div>
        <div className="auth-field"><label htmlFor="income-source">منبع درآمد</label><Select id="income-source" name="source" disabled={busy} options={Object.entries(sources).map(([value, label]) => ({ value, label }))} /></div>
        <div className="auth-field"><label htmlFor="income-member">از جانب</label><Select id="income-member" name="member" required defaultValue={userId} disabled={busy} options={members.map(member => ({ value: member.user_id, label: member.name }))} /></div>
        <LocationField familyId={familyId} disabled={busy} />
        <div className="auth-field"><label htmlFor="income-description">توضیح (اختیاری)</label><textarea id="income-description" name="description" maxLength={500} rows={3} /></div>
        {formError && <p role="alert" className="auth-error">{formError}</p>}
        <Button type="submit">{busy ? "در حال ثبت…" : "ثبت درآمد"}</Button>
      </fieldset></form>
    </DialogContent></Dialog>
  </section>;
}
