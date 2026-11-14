import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ListChecks, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementBack } from "@/components/ManagementBack";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/http";
import { useActiveFamily } from "../families/ActiveFamily";
import type { Family } from "../families/api";
import { ShoppingItems } from "./ShoppingItems";
import { ListCheckout } from "./ListCheckout";
import { ShoppingListCard, type ShoppingList } from "./ShoppingListCard";
import "./shopping.css";

type Result = { lists: ShoppingList[]; has_more: boolean };
const number = (value: number) => value.toLocaleString("fa-IR");

export function Shopping({ onBack, onFamilies }: { onBack: () => void; onFamilies: () => void }) {
  const { selected, setSelected } = useActiveFamily();
  const [family, setFamily] = useState<Family | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [active, setActive] = useState<(ShoppingList & { familyId: string }) | null>(null);
  const [checkout, setCheckout] = useState<(ShoppingList & { familyId: string }) | null>(null);
  const [notice, setNotice] = useState("");
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<"pending" | "purchased">("pending");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const pending = useRef(false);
  const request = useRef({ payload: "", id: "" });
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { setActive(null); setCheckout(null); setNotice(""); setOffset(0); }, [selected]);
  useEffect(() => {
    if (active) return;
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true); setError("");
    async function load() {
      const { families } = await api<{ families: Family[] }>("/families", { signal });
      if (signal.aborted) return;
      if (!selected && families.length) { setSelected(families[0].id); return; }
      const current = families.find(row => row.id === selected) ?? null;
      setFamily(current);
      if (!current) { setResult(null); return; }
      const data = await api<Result>(`/families/${current.id}/shopping/lists?offset=${offset}&status=${status}`, { signal });
      if (signal.aborted) return;
      if (offset && !data.lists.length) { setOffset(0); return; }
      if (!signal.aborted) setResult(data);
    }
    void load().catch(err => { if (!signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, setSelected, active, offset, revision, status]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!family || pending.current) return;
    const fields = new FormData(event.currentTarget);
    const names = fields.getAll("item-name").map(String);
    const quantities = fields.getAll("item-quantity").map(String);
    const body = { name: String(fields.get("list-name") ?? "").trim(), items: names.map((name, index) =>
      ({ name: name.trim(), quantity: quantities[index].trim(), note: "" })) };
    if (!body.name || body.items.some(item => !item.name)) { setFormError("اسم لیست و کالاها رو وارد کنین."); return; }
    const base = `/families/${family.id}/shopping/lists`;
    const payload = JSON.stringify({ base, body });
    if (request.current.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setFormError("");
    try {
      const data = await api<{ list: { id: string; name: string } }>(base,
        { method: "POST", body: { ...body, request_id: request.current.id } });
      setOpen(false);
      setActive({ ...data.list, familyId: family.id, pending_count: body.items.length, purchased_count: 0 });
    } catch (err) { setFormError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }

  if (active && active.familyId === selected) return <ShoppingItems key={active.id} listId={active.id} listName={active.name}
    onBack={() => { setActive(null); setRevision(value => value + 1); }} onFamilies={onFamilies} />;

  return <section className="shopping-page" aria-labelledby="shopping-lists-title">
    <div className="dash-welcome management-title-row"><h1 id="shopping-lists-title" ref={heading} tabIndex={-1}>خریدهای خونه</h1><ManagementBack onBack={onBack} /></div>
    {family && <Button className="shopping-add shopping-new-list" disabled={loading || !!error} onClick={() => {
      request.current = { payload: "", id: "" }; setFormError(""); setOpen(true);
    }}><Plus aria-hidden="true" />لیست خرید جدید</Button>}
    {family && <div className="shopping-list-status" role="group" aria-label="وضعیت لیست‌های خرید">
      <Button variant={status === "pending" ? "default" : "outline"} aria-pressed={status === "pending"}
        onClick={() => { setStatus("pending"); setOffset(0); }}>{status === "pending" && <Check aria-hidden="true" />}در انتظار خرید</Button>
      <Button variant={status === "purchased" ? "default" : "outline"} aria-pressed={status === "purchased"}
        onClick={() => { setStatus("purchased"); setOffset(0); }}>{status === "purchased" && <Check aria-hidden="true" />}خرید شده</Button>
    </div>}
    <p className="shopping-notice" role="status">{notice}</p>
    {error && <div className="shopping-error" role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRevision(value => value + 1)}>تلاش دوباره</Button></div>}
    {loading ? <p className="dash-empty" role="status">در حال دریافت لیست‌های خرید…</p> : !error && !family ?
      <div className="shopping-empty"><h2>خرید رو با خانواده شروع کنین</h2><Button onClick={onFamilies}>رفتن به خانواده</Button></div> : !error && result && <>
      <div className="shopping-list-heading"><h2>لیست‌های خرید</h2><Button variant="ghost" size="icon" aria-label="تازه‌سازی لیست‌ها" onClick={() => setRevision(value => value + 1)}><RefreshCw aria-hidden="true" /></Button></div>
      {result.lists.length ? <ul className="shopping-list">{result.lists.map(list => <ShoppingListCard key={list.id} list={list}
        onOpen={() => family && setActive({ ...list, familyId: family.id })}
        onComplete={() => { if (family) { setNotice(""); setCheckout({ ...list, familyId: family.id }); } }} />)}</ul> : <div className="shopping-empty"><ListChecks aria-hidden="true" /><h2>{status === "purchased" ? "هنوز لیست خریدشده‌ای ندارین" : "لیستی در انتظار خرید ندارین"}</h2><p>{status === "purchased" ? "لیست‌هایی که همهٔ کالاهاشون تیک خورده باشن اینجا نمایش داده می‌شن." : "یه لیست خرید جدید بسازین و کالاهاش رو اضافه کنین."}</p></div>}
      {(offset > 0 || result.has_more) && <div className="shopping-pagination"><Button variant="outline" disabled={!offset} onClick={() => setOffset(value => value - 50)}>قبلی</Button><span>صفحهٔ {number(offset / 50 + 1)}</span><Button variant="outline" disabled={!result.has_more} onClick={() => setOffset(value => value + 50)}>بعدی</Button></div>}
    </>}
    {checkout && checkout.familyId === selected && <ListCheckout key={`${checkout.familyId}:${checkout.id}`} familyId={checkout.familyId}
      listId={checkout.id} listName={checkout.name} onClose={() => setCheckout(null)}
      onComplete={() => { setCheckout(null); setStatus("purchased"); setOffset(0); setNotice("لیست خرید تکمیل شد."); setRevision(value => value + 1); }} />}
    <Dialog open={open} onOpenChange={value => { if (!pending.current) setOpen(value); }}>
      <DialogContent dir="rtl" className="shopping-sheet" showCloseButton={!busy}
        onCloseAutoFocus={event => { event.preventDefault(); heading.current?.focus({ preventScroll: true }); }}
        onEscapeKeyDown={event => { if (pending.current) event.preventDefault(); }}
        onInteractOutside={event => { if (pending.current) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>لیست خرید جدید</DialogTitle><DialogDescription>اسم لیست رو بنویسین و کالاهای خرید رو اضافه کنین.</DialogDescription></DialogHeader>
        <NewListForm busy={busy} onSave={save} onCancel={() => setOpen(false)} />
        {formError && <div className="shopping-error" role="alert">{formError}</div>}
      </DialogContent>
    </Dialog>
  </section>;
}

function NewListForm({ busy, onSave, onCancel }: { busy: boolean; onSave: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const [rows, setRows] = useState([{ id: 0, name: "", quantity: "" }]);
  const next = useRef(1);
  const focusRow = useRef<number | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  return <form className="dash-form shopping-form" onSubmit={onSave}>
    <fieldset disabled={busy}>
      <label htmlFor="shopping-list-name">اسم لیست<input id="shopping-list-name" name="list-name" required maxLength={120} placeholder="مثلاً خرید هفتگی" /></label>
      <div className="shopping-draft-items">{rows.map(({ id, name, quantity }, index) => <div className="shopping-draft-row" key={id}>
        <label htmlFor={`list-item-${id}`}>کالای {number(index + 1)}<input id={`list-item-${id}`} name="item-name" required maxLength={120} placeholder="مثلاً قهوه" value={name}
          onChange={event => setRows(values => values.map(row => row.id === id ? { ...row, name: event.target.value } : row))}
          ref={element => { if (element && focusRow.current === id) { element.focus(); focusRow.current = null; } }} /></label>
        <label htmlFor={`list-quantity-${id}`}>مقدار (اختیاری)<input id={`list-quantity-${id}`} name="item-quantity" maxLength={80} placeholder="مثلاً ۲ بسته" value={quantity}
          onChange={event => setRows(values => values.map(row => row.id === id ? { ...row, quantity: event.target.value } : row))} /></label>
        {name.trim() && <Button type="button" className="shopping-draft-delete" variant="ghost" size="icon" aria-label={`حذف کالای ${number(index + 1)}`}
          onClick={() => {
            if (rows.length === 1) {
              const replacement = next.current++; focusRow.current = replacement;
              setRows([{ id: replacement, name: "", quantity: "" }]);
            } else { setRows(values => values.filter(row => row.id !== id)); addButton.current?.focus(); }
          }}><Trash2 aria-hidden="true" /></Button>}
      </div>)}</div>
      <Button ref={addButton} type="button" variant="outline" disabled={rows.length >= 100} onClick={() => {
        const id = next.current++; focusRow.current = id; setRows(values => [...values, { id, name: "", quantity: "" }]);
      }}><Plus aria-hidden="true" />افزودن کالا به لیست</Button>
    </fieldset>
    <div className="shopping-dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>انصراف</Button><Button type="submit" disabled={busy}>{busy ? "در حال ذخیره…" : "ساخت لیست خرید"}</Button></div>
  </form>;
}
