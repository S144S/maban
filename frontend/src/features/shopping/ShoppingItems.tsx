import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ListChecks, Pencil, Plus, RefreshCw, ShoppingBasket, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementBack } from "@/components/ManagementBack";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, errorMessage } from "@/lib/http";
import { formatReminderDate } from "@/lib/persian-date";
import { useActiveFamily } from "../families/ActiveFamily";
import type { Family } from "../families/api";
import { PurchaseForm, type PurchaseCost } from "./PurchaseForm";
import "./shopping.css";

type Item = { id: string; name: string; quantity: string; note: string; purchased: boolean;
  version: number; created_at: string; purchased_at: string | null; expense_id: string | null };
type List = { items: Item[]; pending_count: number; purchased_count: number; has_more: boolean;
  checkout: { token: string; has_expense: boolean } };
type Modal = { kind: "add" } | { kind: "complete"; token: string; hasExpense: boolean } | { kind: "edit" | "delete" | "undo"; item: Item };
type Filter = "pending" | "purchased";
const number = (value: number) => value.toLocaleString("fa-IR");

export function ShoppingItems({ onBack, onFamilies, listId, listName }: { onBack: () => void; onFamilies: () => void; listId: string; listName: string }) {
  const { selected, setSelected } = useActiveFamily();
  const [family, setFamily] = useState<Family | null>(null);
  const [list, setList] = useState<List | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [formError, setFormError] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const completionCheck = useRef<{ familyId: string; listId: string } | null>(null);
  const request = useRef({ payload: "", id: "" });
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true); setError("");
    async function load() {
      const { families } = await api<{ families: Family[] }>("/families", { signal });
      if (signal.aborted) return;
      if (!selected && families.length) { setSelected(families[0].id); return; }
      const active = families.find(item => item.id === selected) ?? null;
      setFamily(active);
      if (!active) { setList(null); return; }
      const result = await api<List>(`/families/${active.id}/shopping?list_id=${listId}&status=${filter}&offset=${offset}`, { signal });
      if (signal.aborted) return;
      if (offset && !result.items.length) { setOffset(0); return; }
      setList(result);
      const check = completionCheck.current;
      if (check?.familyId === active.id && check.listId === listId) {
        completionCheck.current = null;
        if (!result.pending_count && result.purchased_count > 0) {
          setFilter("purchased"); setOffset(0);
          if (!result.checkout.has_expense) show({ kind: "complete", token: result.checkout.token, hasExpense: false });
        }
      }
    }
    void load().catch(err => { if (!signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, setSelected, filter, offset, revision, listId]);

  function show(next: Modal) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    request.current = { payload: "", id: "" };
    setFormError(""); setStale(false); setNotice(""); setModal(next);
  }
  function refresh() {
    setModal(null); setFormError(""); setStale(false); setError("");
    setRevision(value => value + 1);
  }
  async function mutate(path: string, method: string, body: unknown, message: string, inDialog: boolean, checkCompletion = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setFormError(""); setError(""); setStale(false);
    try {
      await api(path, { method, body });
      if (checkCompletion && family) completionCheck.current = { familyId: family.id, listId };
      if (path.endsWith("/complete")) { setFilter("purchased"); setOffset(0); }
      setModal(null); setNotice(message); setRevision(value => value + 1);
      if (!inDialog) heading.current?.focus({ preventScroll: true });
    } catch (err) {
      const conflict = err instanceof ApiError && (err.status === 409 || err.status === 404);
      if (inDialog) { setFormError(errorMessage(err)); setStale(conflict); }
      else { setError(errorMessage(err)); setNotice(""); }
    } finally { pending.current = false; setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!family || !modal || (modal.kind !== "add" && modal.kind !== "edit")) return;
    const fields = new FormData(event.currentTarget);
    const body = { name: String(fields.get("name") ?? "").trim(), quantity: String(fields.get("quantity") ?? "").trim(),
      note: String(fields.get("note") ?? "").trim() };
    if (!body.name) { setFormError("اسم کالا رو وارد کنین."); return; }
    const base = `/families/${family.id}/shopping`;
    const payload = JSON.stringify({ base, body, listId });
    if (request.current.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    void mutate(modal.kind === "add" ? base : `${base}/${modal.item.id}`, modal.kind === "add" ? "POST" : "PUT",
      modal.kind === "add" ? { ...body, list_id: listId, request_id: request.current.id } : { ...body, version: modal.item.version },
      modal.kind === "add" ? "کالا به لیست خرید اضافه شد." : "تغییرات کالا ذخیره شد.", true);
  }
  function choose(next: Filter) { if (!busy) { setFilter(next); setOffset(0); setNotice(""); } }
  function purchase(item: Item) {
    if (!family) return;
    void mutate(`/families/${family.id}/shopping/${item.id}/status`, "PUT",
      { purchased: true, version: item.version }, "کالا توی خریدشده‌هاست.", false, true);
  }
  function undo(item: Item, inDialog: boolean) {
    if (!family) return;
    void mutate(`/families/${family.id}/shopping/${item.id}/status`, "PUT", { purchased: false, version: item.version },
      item.expense_id ? "کالا به لیست خرید برگشت؛ خرج قبلی در مالی باقی موند." : "کالا به لیست خرید برگشت.", inDialog);
  }
  function complete(cost: PurchaseCost) {
    if (!family || modal?.kind !== "complete") return;
    const path = `/families/${family.id}/shopping/lists/${listId}/complete`;
    const body = { token: modal.token, ...cost };
    const payload = JSON.stringify({ path, body });
    if (request.current.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    void mutate(path, "POST", { ...body, request_id: request.current.id },
      cost.amount_toman ? "لیست تکمیل شد و هزینهٔ کلش در مالی ثبت شد." : "همهٔ کالاهای لیست تکمیل شدن.", true);
  }
  const unavailable = loading || busy || !!error;

  return <section className="shopping-page" aria-labelledby="shopping-title">
    <div className="dash-welcome management-title-row"><h1 id="shopping-title" ref={heading} tabIndex={-1}>{listName}</h1><ManagementBack onBack={onBack} label="بازگشت به لیست‌های خرید" /></div>
    {family && <p className="shopping-family"><Users size={16} aria-hidden="true" /><span>لیست مشترک <bdi>{family.name}</bdi></span></p>}
    <p className="shopping-intro">هر چی برای خونه لازمه اینجا بنویسین؛ بعد از خرید، تیکش رو بزنین.</p>
    {family && <Button className="shopping-add" disabled={unavailable} onClick={() => show({ kind: "add" })}><Plus aria-hidden="true" />افزودن کالا</Button>}
    {family && list && list.pending_count + list.purchased_count > 0 && <Button className="shopping-complete" variant="outline"
      disabled={unavailable || (!list.pending_count && list.checkout.has_expense)}
      onClick={() => show({ kind: "complete", token: list.checkout.token, hasExpense: list.checkout.has_expense })}>
      <ListChecks aria-hidden="true" />{!list.pending_count && list.checkout.has_expense ? "لیست تکمیل شده" : "لیست رو تکمیل کردم"}</Button>}
    <p className="shopping-notice" role="status">{notice}</p>
    {error && <div className="shopping-error" role="alert"><p>{error}</p><Button variant="outline" disabled={busy} onClick={refresh}><RefreshCw aria-hidden="true" />دریافت دوبارهٔ لیست</Button></div>}
    {loading ? <p className="dash-empty" role="status">در حال دریافت لیست خرید…</p> : !family && !error ? <div className="shopping-empty"><ShoppingBasket aria-hidden="true" /><h2>لیست خرید رو با خانواده شروع کنین</h2><p>اول خانوادهٔ فعال رو انتخاب کنین یا یه خانواده بسازین.</p><Button onClick={onFamilies}>رفتن به خانواده</Button></div> : family && list && <>
      <div className="shopping-filters" role="group" aria-label="وضعیت کالاها">
        <button type="button" aria-pressed={filter === "pending"} disabled={busy} onClick={() => choose("pending")}>برای خرید <span>{number(list.pending_count)}</span></button>
        <button type="button" aria-pressed={filter === "purchased"} disabled={busy} onClick={() => choose("purchased")}>خریدشده‌ها <span>{number(list.purchased_count)}</span></button>
      </div>
      <div className="shopping-list-heading"><h2>{filter === "pending" ? "برای خرید" : "خریدشده‌ها"}</h2><Button variant="ghost" size="icon" aria-label="تازه‌سازی لیست خرید" disabled={unavailable} onClick={refresh}><RefreshCw aria-hidden="true" /></Button></div>
      {list.items.length ? <ul className="shopping-list">{list.items.map(item => <li key={item.id} className="shopping-item" data-purchased={item.purchased}>
        <div className="shopping-item-main">
          <button type="button" className="shopping-check" role="checkbox" aria-checked={item.purchased} disabled={unavailable}
            aria-label={`${item.name}؛ ${item.purchased ? "برگردوندن به لیست خرید" : "علامت‌زدن به‌عنوان خریدشده"}`}
            onClick={() => !item.purchased ? purchase(item) : item.expense_id ? show({ kind: "undo", item }) : undo(item, false)}><span>{item.purchased && <Check size={18} aria-hidden="true" />}</span></button>
          <div className="shopping-item-copy"><h3><bdi>{item.name}</bdi></h3>{item.quantity && <p className="shopping-quantity"><bdi>{item.quantity}</bdi></p>}
            {item.note && <p className="shopping-note">{item.note}</p>}
            {item.purchased_at && <p className="shopping-date">خریدشده در <time dateTime={item.purchased_at}>{formatReminderDate(item.purchased_at)}</time></p>}
            {item.expense_id && <p className="shopping-date">هزینه در مالی ثبت شده</p>}
          </div>
        </div>
        <div className="shopping-item-actions"><Button variant="ghost" size="icon" aria-label={`ویرایش ${item.name}`} disabled={unavailable} onClick={() => show({ kind: "edit", item })}><Pencil aria-hidden="true" /></Button><Button variant="ghost" size="icon" aria-label={`حذف ${item.name}`} disabled={unavailable} onClick={() => show({ kind: "delete", item })}><Trash2 aria-hidden="true" /></Button></div>
      </li>)}</ul> : <div className="shopping-empty"><ShoppingBasket aria-hidden="true" /><h3>{filter === "pending" ? "چیزی برای خرید ندارین" : "هنوز خریدی تیک نخورده"}</h3><p>{filter === "pending" ? "یه کالا اضافه کنین تا موقع خرید یادتون بمونه." : "بعد از خرید، کنار کالا تیک بزنین تا اینجا بیاد."}</p></div>}
      {(offset > 0 || list.has_more) && <div className="shopping-pagination"><Button variant="outline" disabled={!offset || unavailable} onClick={() => setOffset(value => Math.max(0, value - 50))}>قبلی</Button><span>صفحهٔ {number(offset / 50 + 1)}</span><Button variant="outline" disabled={!list.has_more || unavailable} onClick={() => setOffset(value => value + 50)}>بعدی</Button></div>}
    </>}
    <Dialog open={modal !== null} onOpenChange={open => { if (!pending.current && !open) setModal(null); }}>
      <DialogContent dir="rtl" {...(modal?.kind === "complete" ? { "aria-describedby": undefined } : {})} className="shopping-sheet" showCloseButton={!busy}
        onOpenAutoFocus={event => { if (modal?.kind === "delete") { event.preventDefault(); cancelDelete.current?.focus(); } }}
        onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected && !opener.current.matches(":disabled")) opener.current.focus(); else heading.current?.focus({ preventScroll: true }); }}
        onEscapeKeyDown={event => { if (pending.current) event.preventDefault(); }} onInteractOutside={event => { if (pending.current) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>{modal?.kind === "complete" ? "هزینهٔ کل لیست چقدر شد؟" : modal?.kind === "undo" ? "برگردوندن به لیست خرید" : modal?.kind === "delete" ? "حذف کالا" : modal?.kind === "edit" ? "ویرایش کالا" : "افزودن کالا"}</DialogTitle>{modal?.kind !== "complete" && <DialogDescription>{modal?.kind === "undo" ? `«${modal.item.name}» به لیست خرید برمی‌گرده. خرجی که قبلاً ثبت شده، در مالی باقی می‌مونه.` : modal?.kind === "delete" ? `«${modal.item.name}» از لیست مشترک خانواده حذف می‌شه. این کار قابل برگشت نیست.${modal.item.expense_id ? " خرج ثبت‌شده در مالی باقی می‌مونه." : ""}` : "اسم کالا رو بنویسین؛ مقدار و توضیح اختیاریه و برای خانواده نمایش داده می‌شه."}</DialogDescription>}</DialogHeader>
        {modal?.kind === "complete" && family ? <PurchaseForm key="whole-list" familyId={family.id} itemName={listName} hasExpense={modal.hasExpense} disabled={busy || stale} busy={busy} onCancel={() => setModal(null)} onSave={complete} /> : modal?.kind === "undo" ? <div className="shopping-dialog-actions"><Button variant="outline" disabled={busy} onClick={() => setModal(null)}>انصراف</Button><Button disabled={busy || stale} onClick={() => undo(modal.item, true)}>{busy ? "در حال ذخیره…" : "برگردوندن کالا"}</Button></div> :
        modal?.kind === "delete" ? <div className="shopping-dialog-actions"><Button ref={cancelDelete} variant="outline" disabled={busy} onClick={() => setModal(null)}>انصراف</Button><Button className="shopping-delete" disabled={busy || stale} onClick={() => family && void mutate(`/families/${family.id}/shopping/${modal.item.id}?version=${modal.item.version}`, "DELETE", undefined, "کالا از لیست حذف شد.", true)}>{busy ? "در حال حذف…" : "حذف کالا"}</Button></div> : modal && (modal.kind === "add" || modal.kind === "edit") && <form key={modal.kind === "edit" ? modal.item.id : "add"} className="dash-form shopping-form" onSubmit={submit}>
          <fieldset disabled={busy || stale}>
            <label htmlFor="shopping-name">اسم کالا<input id="shopping-name" name="name" required maxLength={120} defaultValue={modal.kind === "edit" ? modal.item.name : ""} placeholder="مثلاً شیر" /></label>
            <label htmlFor="shopping-quantity">مقدار <span className="shopping-optional">اختیاری</span><input id="shopping-quantity" name="quantity" maxLength={80} defaultValue={modal.kind === "edit" ? modal.item.quantity : ""} placeholder="مثلاً ۲ بسته یا نیم کیلو" /></label>
            <label htmlFor="shopping-note">توضیح <span className="shopping-optional">اختیاری</span><textarea id="shopping-note" name="note" maxLength={500} rows={3} defaultValue={modal.kind === "edit" ? modal.item.note : ""} placeholder="مثلاً برند یا مدل دلخواه" /></label>
          </fieldset>
          <div className="shopping-dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => setModal(null)}>انصراف</Button><Button type="submit" disabled={busy || stale}>{busy ? "در حال ذخیره…" : modal.kind === "edit" ? "ذخیرهٔ تغییرات" : "افزودن به لیست"}</Button></div>
        </form>}
        {formError && <div className="shopping-error" role="alert"><p>{formError}</p>{stale && <Button variant="outline" onClick={refresh}>بستن فرم و دریافت لیست تازه</Button>}</div>}
      </DialogContent>
    </Dialog>
  </section>;
}
