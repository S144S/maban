import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Leaf, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/http";
import { formatReminderDate } from "@/lib/persian-date";
import { useActiveFamily } from "../families/ActiveFamily";
import type { Family, Member } from "../families/api";
import { PlantForm, type PlantFields } from "./PlantForm";
import { careLabels, formatDay, statusLabel, type CareAction, type CareEvent, type Plant, type Schedule } from "./model";
import "./plants.css";

type PlantPage = { plants: Plant[]; has_more: boolean; timezone: string };
type History = { events: CareEvent[]; has_more: boolean };
type Modal = "add" | "edit" | "care" | "delete" | null;

function ScheduleInfo({ label, schedule }: { label: string; schedule: Schedule }) {
  return <div className="plant-schedule" data-due={schedule.status !== "upcoming"}>
    <strong>{label} · {statusLabel(schedule)}</strong><span>{formatDay(schedule.next_due)}</span>
    <span className="dash-muted">هر {schedule.interval_days.toLocaleString("fa-IR")} روز</span>
  </div>;
}

export function Plants({ onFamilies }: { onFamilies: () => void }) {
  const { selected, setSelected } = useActiveFamily();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [items, setItems] = useState<Plant[]>([]);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [history, setHistory] = useState<History>({ events: [], has_more: false });
  const [offset, setOffset] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const request = useRef({ payload: "", id: "" });
  const opener = useRef<HTMLElement | null>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusedDetail = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true); setError("");
    async function load() {
      const families = (await api<{ families: Family[] }>("/families", { signal })).families;
      if (signal.aborted) return;
      if (!selected && families.length) { setSelected(families[0].id); return; }
      const active = families.find(f => f.id === selected) ?? null;
      setFamily(active);
      if (!active) return;
      const base = `/families/${active.id}`;
      const [detail, list, current, events] = await Promise.all([
        api<{ members: Member[] }>(base, { signal }),
        api<PlantPage>(`${base}/plants?offset=${offset}`, { signal }),
        plantId ? api<{ plant: Plant }>(`${base}/plants/${plantId}`, { signal }) : Promise.resolve(null),
        plantId ? api<History>(`${base}/plants/${plantId}/history?offset=${historyOffset}`, { signal }) : Promise.resolve(null),
      ]);
      if (signal.aborted) return;
      if (offset > 0 && !list.plants.length && !plantId) { setOffset(Math.max(0, offset - 50)); return; }
      setMembers(detail.members); setItems(list.plants); setHasMore(list.has_more);
      setPlant(current?.plant ?? null); setHistory(events ?? { events: [], has_more: false });
    }
    void load().catch(err => { if (!signal.aborted) setError(errorMessage(err)); }).finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, plantId, offset, historyOffset, revision, setSelected]);

  useEffect(() => {
    // Refresh date-derived statuses after midnight, returning to the app, or a long open session.
    const refresh = () => { if (!pending.current && !modal) setRevision(n => n + 1); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [modal]);
  useEffect(() => {
    if (!loading && focusedDetail.current !== plantId) {
      heading.current?.focus({ preventScroll: true }); focusedDetail.current = plantId;
    }
  }, [plantId, loading]);

  function show(next: Modal) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    request.current = { payload: "", id: "" }; setFormError(""); setNotice(""); setModal(next);
  }
  async function perform(body: PlantFields | { action: CareAction; note: string } | null) {
    if (pending.current || !family) return;
    const base = `/families/${family.id}/plants`;
    const url = modal === "add" ? base : `${base}/${plant?.id}${modal === "care" ? "/care" : ""}`;
    const payload = JSON.stringify({ url, body });
    if (request.current.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setFormError("");
    try {
      await api(url, { method: modal === "delete" ? "DELETE" : modal === "edit" ? "PUT" : "POST",
        body: body === null ? undefined : modal === "add" || modal === "care" ? { ...body, request_id: request.current.id } : body });
      if (modal === "delete") { setPlantId(null); setPlant(null); }
      if (modal === "care") setHistoryOffset(0);
      setNotice(modal === "delete" ? "گلدون حذف شد." : modal === "care" ? "رسیدگی ثبت شد؛ نوبت بعدی هم تنظیم شد." : "گلدون ذخیره شد.");
      setModal(null); setRevision(n => n + 1);
    } catch (err) { setFormError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  function submitCare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void perform({ action: String(data.get("action")) as CareAction, note: String(data.get("note") ?? "").trim() });
  }

  return <section className="plants-page" aria-labelledby="plants-title">
    <div className="dash-welcome"><h1 id="plants-title" ref={heading} tabIndex={-1}>{plantId && plant ? plant.name : "گلدون‌ها"}</h1>
      {!plantId && family && <Button disabled={loading || !!error} onClick={() => show("add")}><Plus aria-hidden="true" />افزودن گلدون</Button>}
    </div>
    {family && <p className="plants-family">خانوادهٔ {family.name} · رسیدگی مشترک</p>}
    {notice && <p role="status" className="plants-notice">{notice}</p>}
    {plantId && <Button variant="ghost" onClick={() => { setPlantId(null); setHistoryOffset(0); }}><ArrowRight aria-hidden="true" />همهٔ گلدون‌ها</Button>}
    {loading ? <p role="status">در حال دریافت گلدون‌ها…</p> : error ? <div role="alert"><p className="dash-error">{error}</p><Button variant="outline" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div>
      : !family ? <div className="plants-empty"><Leaf aria-hidden="true" /><h2>گلدون‌ها رو با خانواده همراه کنین</h2><p>اول از بخش خانواده، یه خانواده بسازین یا خانوادهٔ فعال رو انتخاب کنین.</p><Button onClick={onFamilies}>رفتن به خانواده</Button></div>
      : plant ? <>
        <article className="plant-card">
          <dl className="plant-info"><div><dt>محل قرارگیری</dt><dd>{plant.location}</dd></div>{plant.species && <div><dt>نوع گیاه</dt><dd>{plant.species}</dd></div>}
            <div><dt>مسئول رسیدگی</dt><dd>{plant.assignee_id ? members.find(m => m.user_id === plant.assignee_id)?.name ?? "عضو خانواده" : "همه با هم"}</dd></div></dl>
          {plant.note && <p className="plant-note">{plant.note}</p>}
          <ScheduleInfo label="بررسی خاک" schedule={plant.soil} />
          {plant.soil.status !== "upcoming" && <p>وقتشه خاک این گلدون رو بررسی کنین.</p>}
          {plant.fertilizer ? <ScheduleInfo label="کوددهی" schedule={plant.fertilizer} /> : <p className="dash-muted">برنامهٔ کوددهی تنظیم نشده.</p>}
          <p className="dash-muted">موعدها به وقت تهرانن؛ برنامهٔ بررسی خاک به معنی نیاز قطعی به آب نیست.</p>
          <div className="plant-actions"><Button onClick={() => show("care")}>ثبت رسیدگی</Button><Button variant="outline" onClick={() => show("edit")}>ویرایش و برنامهٔ رسیدگی</Button><Button variant="ghost" className="plant-delete" onClick={() => show("delete")}>حذف گلدون</Button></div>
        </article>
        <section className="plant-history" aria-labelledby="history-title"><h2 id="history-title">تاریخچهٔ رسیدگی</h2>
          {history.events.length ? <ol>{history.events.map(event => <li key={event.id}><strong>{careLabels[event.action]}</strong><span>{event.actor_name}</span><time dateTime={event.performed_at}>{formatReminderDate(event.performed_at)} · تهران</time>{event.note && <p className="plant-note">{event.note}</p>}<span className="dash-muted">نوبت بعدیِ ثبت‌شده: {formatDay(event.next_due)}</span></li>)}</ol> : <p className="dash-muted">هنوز رسیدگی‌ای ثبت نشده؛ اولین بررسی خاک رو ثبت کنین.</p>}
          {(historyOffset > 0 || history.has_more) && <div className="plant-actions"><Button variant="outline" disabled={!historyOffset} onClick={() => setHistoryOffset(n => Math.max(0, n - 50))}>رسیدگی‌های جدیدتر</Button><Button variant="outline" disabled={!history.has_more} onClick={() => setHistoryOffset(n => n + 50)}>رسیدگی‌های قدیمی‌تر</Button></div>}
        </section>
      </> : <>
        {items.length ? <ul className="plants-list">{items.map(item => <li key={item.id}><article className="plant-card"><Leaf className="plant-symbol" aria-hidden="true" /><h2>{item.name}</h2><p className="dash-muted">{item.location}</p><ScheduleInfo label="بررسی خاک" schedule={item.soil} />{item.fertilizer && <ScheduleInfo label="کوددهی" schedule={item.fertilizer} />}{item.soil.status !== "upcoming" && <p>وقتشه خاک این گلدون رو بررسی کنین.</p>}<Button variant="outline" onClick={() => { setPlantId(item.id); setHistoryOffset(0); setNotice(""); }}>جزئیات و رسیدگی به {item.name}</Button></article></li>)}</ul>
          : <div className="plants-empty"><Leaf aria-hidden="true" /><h2>یه گوشهٔ سبز برای خونه</h2><p>اولین گلدون رو اضافه کنین تا با هم حواسمون بهش باشه.</p><Button onClick={() => show("add")}>افزودن گلدون</Button></div>}
        {(offset > 0 || hasMore) && <div className="plant-actions"><Button variant="outline" disabled={!offset} onClick={() => setOffset(n => Math.max(0, n - 50))}>قبلی</Button><Button variant="outline" disabled={!hasMore} onClick={() => setOffset(n => n + 50)}>بعدی</Button></div>}
      </>}
    <Dialog open={modal !== null} onOpenChange={open => { if (!pending.current && !open) setModal(null); }}>
      <DialogContent className="plants-sheet" dir="rtl" showCloseButton={!busy}
        onOpenAutoFocus={event => { if (modal === "delete") { event.preventDefault(); cancelDelete.current?.focus(); } }}
        onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); else heading.current?.focus(); }}
        onEscapeKeyDown={event => { if (busy || event.target instanceof Element && event.target.closest('[data-calendar-open="true"]')) event.preventDefault(); }}
        onInteractOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>{modal === "add" ? "افزودن گلدون" : modal === "edit" ? "ویرایش گلدون و برنامه" : modal === "care" ? "ثبت رسیدگی" : "حذف گلدون"}</DialogTitle>
          <DialogDescription>{modal === "delete" ? `گلدون «${plant?.name}»، برنامه‌ها و تاریخچه‌اش از دسترس خانواده خارج می‌شن. این کار قابل برگشت نیست.` : modal === "care" ? "خاک رو بررسی کنین و نتیجه رو ثبت کنین. نوبت بعدی از روز انجام کار، به وقت تهران حساب می‌شه." : "یه برنامهٔ ساده برای رسیدگی مشترک بچینین. یادآوری‌ها فقط داخل مابان نمایش داده می‌شن."}</DialogDescription></DialogHeader>
        {(modal === "add" || modal === "edit") && <PlantForm key={modal + (plant?.id ?? "")} plant={modal === "edit" ? plant : null} members={members} busy={busy} error={formError} onSubmit={body => void perform(body)} />}
        {modal === "care" && <form onSubmit={submitCare}><fieldset className="dash-form plants-form" disabled={busy}>
          <label htmlFor="care-action">نتیجهٔ رسیدگی<Select id="care-action" name="action" defaultValue="watered" disabled={busy} options={Object.entries(careLabels).filter(([key]) => key !== "fertilized" || plant?.fertilizer).map(([value, label]) => ({ value, label }))} /></label>
          <label htmlFor="care-note">یادداشت (اختیاری)<textarea id="care-note" name="note" rows={3} maxLength={2000} /></label>
          {formError && <p role="alert" className="dash-error">{formError}</p>}
          <Button type="submit">{busy ? "در حال ثبت…" : "ثبت رسیدگی"}</Button>
        </fieldset></form>}
        {modal === "delete" && <>{formError && <p role="alert" className="dash-error">{formError}</p>}<Button className="plant-confirm-delete" disabled={busy} onClick={() => void perform(null)}>{busy ? "در حال حذف…" : "حذف گلدون و تاریخچه"}</Button><Button ref={cancelDelete} variant="outline" disabled={busy} onClick={() => setModal(null)}>انصراف</Button></>}
      </DialogContent>
    </Dialog>
  </section>;
}
