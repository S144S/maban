import { ExpenseCategories } from "../expenses/ExpenseCategories";
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Wallet, Users, Pencil, Trash2, Tags, ChevronDown, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/http";
import type { Family } from "../families/api";
import type { MoneyLocation } from "./LocationField";
import "./management.css";
const Reminders = lazy(() => import("../reminders/Reminders").then(module => ({ default: module.Reminders })));

export function Management({ userId }: { userId: string }) {
  const [section, setSection] = useState<"accounts" | "categories" | "reminders" | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [selected, setSelected] = useState(new URLSearchParams(window.location.search).get("family") ?? "");
  const [data, setData] = useState<{ familyId: string; locations: MoneyLocation[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MoneyLocation | null>(null);
  const [deleting, setDeleting] = useState<MoneyLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const request = useRef({ name: "", id: "" });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null);
    async function load() {
      const result = await api<{ families: Family[] }>("/families", { signal: controller.signal });
      if (controller.signal.aborted) return;
      const owned = result.families.filter(f => f.owner_id === userId);
      setFamilies(owned);
      const familyId = owned.find(f => f.id === selected)?.id ?? owned[0]?.id;
      if (!familyId) return;
      const locations = await api<{ locations: MoneyLocation[] }>(`/families/${familyId}/money-locations`, { signal: controller.signal });
      if (!controller.signal.aborted) setData({ familyId, locations: locations.locations });
    }
    void load().catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, revision, userId]);
  const canWrite = !!data && families.some(f => f.id === data.familyId && f.owner_id === userId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !canWrite || pending.current) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) { setFormError("نام حساب رو وارد کنین."); return; }
    if (request.current.name !== name) request.current = { name, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setFormError("");
    try {
      await api(`/families/${data.familyId}/money-locations${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", body: editing ? { name } : { name, request_id: request.current.id } });
      setOpen(false); setNotice(editing ? "نام حساب تغییر کرد." : "حساب اضافه شد."); setRevision(n => n + 1);
    } catch (err) { setFormError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function removeAccount() {
    if (!data || !deleting || !canWrite || pending.current) return;
    pending.current = true; setBusy(true); setFormError("");
    try {
      await api(`/families/${data.familyId}/money-locations/${deleting.id}`, { method: "DELETE" });
      setDeleting(null); setNotice("حساب حذف شد؛ دخل‌های قبلی حفظ شدن."); setRevision(n => n + 1);
    } catch (err) { setFormError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="management-page">
    {families.length > 1 && <div className="dash-form"><label htmlFor="management-family">خانواده<Select id="management-family" value={data?.familyId ?? selected} disabled={busy || loading} onValueChange={value => { setSelected(value); setNotice(""); }} options={families.map(f => ({ value: f.id, label: f.name }))} /></label></div>}
    <div className="management-menu">
    {loading ? <p role="status">در حال دریافت اطلاعات…</p> : error ? <div role="alert"><p className="dash-error">{error}</p><Button variant="outline" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div> : !data ? <p>مدیریت حساب‌ها و دسته‌بندی‌های خانواده فقط برای سازندهٔ خانواده است. می‌تونین از <a className="underline" href="/families">صفحهٔ خانواده</a> خانوادهٔ خودتون رو بسازین.</p> : <>
      <div className="management-disclosure">
        <h2><button type="button" id="accounts-toggle" className="management-menu-item" aria-expanded={section === "accounts"} aria-controls="accounts-panel" onClick={() => setSection(current => current === "accounts" ? null : "accounts")}>
          <span className="management-menu-icon"><Wallet size={24} aria-hidden="true" /></span>
          <span className="management-menu-copy"><strong>حساب‌های خانواده</strong><span>افزودن و ویرایش حساب‌های بانکی، نقدی و کارت هدیه</span></span>
          <ChevronDown size={20} aria-hidden="true" />
        </button></h2>
        <section id="accounts-panel" hidden={section !== "accounts"} aria-labelledby="accounts-toggle">
    <div className="management-body">
      <p className="management-family"><Users size={18} aria-hidden="true" /><span>مشترک با خانوادهٔ {families.find(f => f.id === data.familyId)?.name}</span></p>
      {data.locations.length ? <ul className="management-list">{data.locations.map(location => <li key={location.id}><span className="management-account-icon"><Wallet size={20} aria-hidden="true" /></span><div className="management-account-copy"><strong>{location.name}</strong></div>{canWrite && <Button variant="ghost" size="icon" aria-label={`ویرایش نام ${location.name}`} onClick={() => { setEditing(location); setFormError(""); setOpen(true); }}><Pencil size={18} aria-hidden="true" /></Button>}{canWrite && <Button className="management-delete" variant="ghost" size="icon" aria-label={`حذف حساب ${location.name}`} onClick={() => { setFormError(""); setDeleting(location); }}><Trash2 size={18} aria-hidden="true" /></Button>}</li>)}</ul> : <div className="management-empty"><span className="management-empty-icon"><Wallet size={32} aria-hidden="true" /></span><h3>اولین حساب رو اضافه کنین</h3><p>مثلاً بانک ملی یا پول نقد؛ موقع ثبت دخل، حساب مقصد رو انتخاب می‌کنین.</p></div>}
      {canWrite ? <Button className="management-add" onClick={() => { setEditing(null); request.current = { name: "", id: "" }; setFormError(""); setOpen(true); }}><Plus aria-hidden="true" />افزودن حساب</Button> : <p className="management-family">مدیریت حساب‌ها فقط برای سازندهٔ خانواده است.</p>}
    <p className="management-notice" role="status">{notice}</p>
    </div>
    <Dialog open={open} onOpenChange={value => { if (!pending.current) setOpen(value); }}><DialogContent className="management-sheet" dir="rtl" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>{editing ? "ویرایش نام حساب" : "افزودن حساب"}</DialogTitle><DialogDescription>{editing ? "نام جدید رو وارد کنین. دخل‌های ثبت‌شده به همین حساب متصل می‌مونن." : "این حساب برای ثبت دخلِ خانواده در دسترس اعضا قرار می‌گیره."}</DialogDescription></DialogHeader><form onSubmit={submit}><fieldset className="dash-form" disabled={busy}><label htmlFor="location-name">نام حساب<input id="location-name" name="name" defaultValue={editing?.name ?? ""} required maxLength={80} placeholder="مثلاً بانک ملی" /></label>{formError && <p className="dash-error" role="alert">{formError}</p>}<Button type="submit">{busy ? "در حال ثبت…" : editing ? "ذخیرهٔ تغییرات" : "افزودن حساب"}</Button></fieldset></form></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={value => { if (!value && !pending.current) setDeleting(null); }}><DialogContent className="management-sheet" dir="rtl" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>حذف حساب</DialogTitle><DialogDescription>حساب «{deleting?.name}» از فهرست و انتخاب دخل جدید حذف می‌شه. دخل‌های قبلی به همین حساب متصل می‌مونن و موجودی خانواده تغییر نمی‌کنه.</DialogDescription></DialogHeader>{formError && <p className="dash-error" role="alert">{formError}</p>}<div className="dash-form"><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>انصراف</Button><Button className="management-confirm-delete" disabled={busy} onClick={() => void removeAccount()}>{busy ? "در حال حذف…" : "حذف حساب"}</Button></div></DialogContent></Dialog>
        </section>
      </div>
      <div className="management-disclosure">
        <h2><button type="button" id="categories-toggle" className="management-menu-item" aria-expanded={section === "categories"} aria-controls="categories-panel" onClick={() => setSection(current => current === "categories" ? null : "categories")}>
          <span className="management-menu-icon"><Tags size={24} aria-hidden="true" /></span>
          <span className="management-menu-copy"><strong>دسته‌بندی خرج‌ها</strong><span>مدیریت دسته‌بندی‌ها و سقف خرج ماهانه</span></span>
          <ChevronDown size={20} aria-hidden="true" />
        </button></h2>
        <div id="categories-panel" hidden={section !== "categories"} role="region" aria-labelledby="categories-toggle">
          {section === "categories" && canWrite && <ExpenseCategories key={data.familyId} familyId={data.familyId} />}
        </div>
      </div>
    </>}
      <div className="management-disclosure">
        <h2><button type="button" id="reminders-toggle" className="management-menu-item" aria-expanded={section === "reminders"} aria-controls="reminders-panel" onClick={() => setSection(current => current === "reminders" ? null : "reminders")}>
          <span className="management-menu-icon"><Bell size={24} aria-hidden="true" /></span>
          <span className="management-menu-copy"><strong>تنظیم هشدار و یادآور</strong><span>یادآورهای شخصی برای قسط و موعدهای مهم</span></span>
          <ChevronDown size={20} aria-hidden="true" />
        </button></h2>
        <div id="reminders-panel" hidden={section !== "reminders"} role="region" aria-labelledby="reminders-toggle">
          {section === "reminders" && <Suspense fallback={<p className="management-body" role="status">در حال آماده‌سازی یادآورها…</p>}><Reminders key={userId} /></Suspense>}
        </div>
      </div>
    </div>
  </div>;
}
