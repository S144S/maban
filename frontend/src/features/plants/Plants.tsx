import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Leaf, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementBack } from "@/components/ManagementBack";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/http";
import { formatReminderDate } from "@/lib/persian-date";
import { useActiveFamily } from "../families/ActiveFamily";
import type { Family, Member } from "../families/api";
import { PlantForm, type PlantFields } from "./PlantForm";
import { PlantImage, PlantPhoto } from "./PlantPhoto";
import { careLabels, type CareAction, type CareEvent, type Plant } from "./model";
import "./plants.css";

type PlantPage = { plants: Plant[]; has_more: boolean; timezone: string };
type History = { events: CareEvent[]; has_more: boolean };
type Modal = "add" | "edit" | "care" | "delete" | null;

export function Plants({ onFamilies, embedded = false, onAllPlants, onBack }: { onFamilies: () => void; embedded?: boolean; onAllPlants?: () => void; onBack?: () => void }) {
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
  const [deleteTarget, setDeleteTarget] = useState<Plant | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeWarning, setNoticeWarning] = useState(false);
  const [unsavedPhoto, setUnsavedPhoto] = useState<{ plantId: string; file: File } | null>(null);
  const pending = useRef(false);
  const photoActivity = useRef(false);
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
    if (!loading && focusedDetail.current !== plantId) {
      // Loading the home summary must not move focus away from financial actions.
      if (!embedded || plantId || focusedDetail.current) heading.current?.focus({ preventScroll: true });
      focusedDetail.current = plantId;
    }
  }, [plantId, loading, embedded]);

  function show(next: Modal) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    request.current = { payload: "", id: "" }; setFormError(""); setNotice(""); setNoticeWarning(false); setModal(next);
  }
  function showDelete(target: Plant) {
    setDeleteTarget(target);
    show("delete");
  }
  async function perform(body: PlantFields | { action: CareAction; note: string } | null, photo: File | null = null) {
    if (pending.current || !family || modal === "delete" && !deleteTarget) return;
    const base = `/families/${family.id}/plants`;
    const url = modal === "add" ? base : `${base}/${modal === "delete" ? deleteTarget?.id : plant?.id}${modal === "care" ? "/care" : ""}`;
    const payload = JSON.stringify({ url, body });
    if (request.current.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setFormError("");
    try {
      const result = await api<{ plant?: Plant }>(url, { method: modal === "delete" ? "DELETE" : modal === "edit" ? "PUT" : "POST",
        body: body === null ? undefined : modal === "add" || modal === "care" ? { ...body, request_id: request.current.id } : body });
      let photoFailure = "";
      if (modal === "add" && result.plant) {
        // Creation has committed. A photo failure must never cause another plant
        // to be created: open its details and retain the file for an explicit retry.
        if (photo) {
          try {
            await api(`/families/${family.id}/plants/${result.plant.id}/photo`, { method: "PUT", body: photo });
            setUnsavedPhoto(null);
          } catch (err) {
            photoFailure = `گلدون ذخیره شد، ولی ذخیرهٔ عکس تأیید نشد. ${errorMessage(err)} با دکمهٔ ویرایش گلدون، ذخیرهٔ عکس رو دوباره امتحان کنین.`;
            setUnsavedPhoto({ plantId: result.plant.id, file: photo });
          }
        }
        setPlantId(result.plant.id); setHistoryOffset(0);
      }
      if (modal === "delete") { setPlantId(null); setPlant(null); setDeleteTarget(null); setUnsavedPhoto(null); }
      if (modal === "care") setHistoryOffset(0);
      setNoticeWarning(!!photoFailure);
      setNotice(photoFailure || (modal === "delete" ? "گلدون حذف شد." : modal === "care" ? "رسیدگی ثبت شد." : photo ? "گلدون و عکسش ذخیره شدن." : "گلدون ذخیره شد."));
      setModal(null); setRevision(n => n + 1);
    } catch (err) { setFormError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  function submitCare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void perform({ action: String(data.get("action")) as CareAction, note: String(data.get("note") ?? "").trim() });
  }

  const Heading = embedded ? "h2" : "h1";
  const ItemHeading = embedded ? "h3" : "h2";
  const visibleItems = embedded ? items.slice(0, 3) : items;

  return <section className={`plants-page${embedded ? " plants-home" : ""}`} aria-labelledby="plants-title">
    <div className="dash-welcome">{onBack || plantId ? <div className="management-title-row"><Heading id="plants-title" ref={heading} tabIndex={-1}>{plantId && plant ? plant.name : "گلدون‌های ما"}</Heading><ManagementBack label={plantId ? "بازگشت به گلدون‌های ما" : undefined} onBack={plantId ? () => { setPlantId(null); setHistoryOffset(0); setNotice(""); } : onBack!} /></div> : <Heading id="plants-title" ref={heading} tabIndex={-1}>{plantId && plant ? plant.name : "گلدون‌های ما"}</Heading>}
      {!plantId && family && <Button disabled={loading || !!error} onClick={() => show("add")}><Plus aria-hidden="true" />افزودن گلدون</Button>}
    </div>
    {notice && <p role={noticeWarning ? "alert" : "status"} className={`plants-notice${noticeWarning ? " plants-notice-warning" : ""}`}>{notice}</p>}
    {loading ? <p role="status">در حال دریافت گلدون‌ها…</p> : error ? <div role="alert"><p className="dash-error">{error}</p><Button variant="outline" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div>
      : !family ? <div className="plants-empty"><Leaf aria-hidden="true" /><h2>گلدون‌ها رو با خانواده همراه کنین</h2><p>اول از بخش خانواده، یه خانواده بسازین یا خانوادهٔ فعال رو انتخاب کنین.</p><Button onClick={onFamilies}>رفتن به خانواده</Button></div>
      : plant ? <>
        <article className="plant-card">
          {plant.photo_url && <PlantImage key={plant.photo_url} src={plant.photo_url} name={plant.name} />}
          <p><bdi>{plant.name}</bdi> در <bdi>{plant.location}</bdi> زندگی می‌کنه <span aria-hidden="true">😊❤️</span></p>
          {plant.note && <p className="plant-note">{plant.note}</p>}
          <div className="plant-actions"><Button onClick={() => show("care")}>ثبت رسیدگی</Button><Button variant="ghost" size="icon" className="plant-edit" aria-label={`ویرایش گلدون ${plant.name}`} title="ویرایش گلدون" onClick={() => show("edit")}><Pencil aria-hidden="true" /></Button><Button variant="ghost" size="icon" className="plant-delete" aria-label={`حذف گلدون ${plant.name}`} title="حذف گلدون" onClick={() => showDelete(plant)}><Trash2 aria-hidden="true" /></Button></div>
        </article>
        <section className="plant-history" aria-labelledby="history-title"><h2 id="history-title">تاریخچهٔ رسیدگی</h2>
          {history.events.length ? <ol>{history.events.map(event => <li key={event.id}><strong>{careLabels[event.action]}</strong><span>{event.actor_name}</span><time dateTime={event.performed_at}>{formatReminderDate(event.performed_at)} · تهران</time>{event.note && <p className="plant-note">{event.note}</p>}</li>)}</ol> : <p className="dash-muted">هنوز رسیدگی‌ای ثبت نشده؛ اولین رسیدگی رو ثبت کنین.</p>}
          {(historyOffset > 0 || history.has_more) && <div className="plant-actions"><Button variant="outline" disabled={!historyOffset} onClick={() => setHistoryOffset(n => Math.max(0, n - 50))}>رسیدگی‌های جدیدتر</Button><Button variant="outline" disabled={!history.has_more} onClick={() => setHistoryOffset(n => n + 50)}>رسیدگی‌های قدیمی‌تر</Button></div>}
        </section>
      </> : <>
        {items.length ? embedded ? <ul className="plants-home-list">{visibleItems.map(item => {
          return <li key={item.id}><button type="button" className="plants-home-row" onClick={() => { setPlantId(item.id); setHistoryOffset(0); setNotice(""); }} aria-label={`جزئیات و رسیدگی به ${item.name}`}>
            {item.photo_url ? <img src={item.photo_url} alt="" width={44} height={44} loading="lazy" /> : <span className="plants-home-icon"><Leaf aria-hidden="true" /></span>}
            <span className="plants-home-copy"><strong>{item.name}</strong><span>{item.location}</span></span><ArrowRight className="plants-home-arrow" aria-hidden="true" />
          </button></li>;
        })}</ul> : <ul className="plants-list">{visibleItems.map(item => <li key={item.id}><article className="plant-card"><header className="plant-card-heading">{item.photo_url ? <PlantImage key={item.photo_url} src={item.photo_url} name={item.name} thumbnail /> : <span className="plant-thumbnail plant-thumbnail-placeholder"><Leaf className="plant-symbol" aria-hidden="true" /></span>}<div><ItemHeading>{item.name}</ItemHeading><p className="dash-muted">{item.location}</p></div></header><div className="plant-actions"><Button variant="outline" onClick={() => { setPlantId(item.id); setHistoryOffset(0); setNotice(""); }}>جزئیات و رسیدگی به {item.name}</Button><Button variant="ghost" size="icon" className="plant-delete" aria-label={`حذف گلدون ${item.name}`} title="حذف گلدون" onClick={() => showDelete(item)}><Trash2 aria-hidden="true" /></Button></div></article></li>)}</ul>
          : <div className="plants-empty"><Leaf aria-hidden="true" /><h2>یه گوشهٔ سبز برای خونه</h2><p>اولین گلدون رو اضافه کنین تا با هم حواسمون بهش باشه.</p><Button onClick={() => show("add")}>افزودن گلدون</Button></div>}
        {embedded && !!items.length && onAllPlants && <Button variant="outline" onClick={onAllPlants}>همهٔ گلدون‌ها</Button>}
        {!embedded && (offset > 0 || hasMore) && <div className="plant-actions"><Button variant="outline" disabled={!offset} onClick={() => setOffset(n => Math.max(0, n - 50))}>قبلی</Button><Button variant="outline" disabled={!hasMore} onClick={() => setOffset(n => n + 50)}>بعدی</Button></div>}
      </>}
    <Dialog open={modal !== null} onOpenChange={open => { if (!pending.current && !open) setModal(null); }}>
      <DialogContent className="plants-sheet" dir="rtl" showCloseButton={!busy}
        onOpenAutoFocus={event => { if (modal === "delete") { event.preventDefault(); cancelDelete.current?.focus(); } }}
        onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); else heading.current?.focus(); }}
        onEscapeKeyDown={event => { if (busy || event.target instanceof Element && event.target.closest('[data-calendar-open="true"]')) event.preventDefault(); }}
        onInteractOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>{modal === "add" ? "افزودن گلدون" : modal === "edit" ? "ویرایش گلدون" : modal === "care" ? "ثبت رسیدگی" : "حذف گلدون"}</DialogTitle>
          <DialogDescription>{modal === "delete" ? `گلدون «${deleteTarget?.name}» و تاریخچه‌اش از دسترس خانواده خارج می‌شن و عکسش حذف می‌شه. این کار قابل برگشت نیست.` : modal === "care" ? "کاری که انجام دادین رو ثبت کنین تا بقیهٔ اعضای خانواده هم در جریان باشن." : modal === "add" ? "اسم و نوع گلدون رو وارد کنین؛ اگه دوست داشتین عکسش رو هم اضافه کنین." : "اطلاعات گلدون رو به‌روز کنین."}</DialogDescription></DialogHeader>
        {(modal === "add" || modal === "edit") && <PlantForm key={modal + (plant?.id ?? "")} plant={modal === "edit" ? plant : null} members={members} busy={busy} error={formError} onSubmit={(body, photo) => void perform(body, photo)} />}
        {modal === "edit" && plant && family && <PlantPhoto key={plant.id + (plant.photo_url ?? "")} plant={plant} familyId={family.id} initialFile={unsavedPhoto?.plantId === plant.id ? unsavedPhoto.file : null} activity={photoActivity} onSaved={message => { setUnsavedPhoto(null); setNoticeWarning(false); setNotice(message); focusedDetail.current = undefined; setRevision(n => n + 1); }} />}
        {modal === "care" && <form onSubmit={submitCare}><fieldset className="dash-form plants-form" disabled={busy}>
          <label htmlFor="care-action">نتیجهٔ رسیدگی<Select id="care-action" name="action" defaultValue="watered" disabled={busy} options={Object.entries(careLabels).filter(([action]) => action !== "not_needed").map(([value, label]) => ({ value, label }))} /></label>
          <label htmlFor="care-note">یادداشت (اختیاری)<textarea id="care-note" name="note" rows={3} maxLength={2000} /></label>
          {formError && <p role="alert" className="dash-error">{formError}</p>}
          <Button type="submit">{busy ? "در حال ثبت…" : "ثبت رسیدگی"}</Button>
        </fieldset></form>}
        {modal === "delete" && <>{formError && <p role="alert" className="dash-error">{formError}</p>}<Button className="plant-confirm-delete" disabled={busy} onClick={() => void perform(null)}>{busy ? "در حال حذف…" : "حذف گلدون و تاریخچه"}</Button><Button ref={cancelDelete} variant="outline" disabled={busy} onClick={() => setModal(null)}>انصراف</Button></>}
      </DialogContent>
    </Dialog>
  </section>;
}
