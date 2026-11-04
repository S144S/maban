import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/http";
import { CategoryIcon, categoryIcons } from "./categoryIcons";
import type { ExpenseCategory } from "./CategoryField";

export function ExpenseCategories({ familyId }: { familyId: string }) {
  const [items, setItems] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [deleting, setDeleting] = useState<ExpenseCategory | null>(null);
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState("tag");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const request = useRef({ name: "", icon: "tag", id: "" });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api<{ categories: ExpenseCategory[] }>(`/families/${familyId}/expenses/categories`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems(data.categories); })
      .catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [familyId, revision]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) { setFormError("نام دسته‌بندی رو وارد کنین."); return; }
    if (request.current.name !== name || request.current.icon !== icon) request.current = { name, icon, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setFormError("");
    try {
      await api(`/families/${familyId}/expenses/categories${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", body: editing ? { name, icon } : { name, icon, request_id: request.current.id } });
      setOpen(false); setNotice(editing ? "دسته‌بندی ویرایش شد." : "دسته‌بندی اضافه شد؛ حالا موقع ثبت خرج می‌تونین انتخابش کنین."); setRevision(n => n + 1);
    } catch (err) { setFormError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function remove() {
    if (!deleting || pending.current) return;
    pending.current = true; setBusy(true); setFormError("");
    try {
      await api(`/families/${familyId}/expenses/categories/${deleting.id}`, { method: "DELETE" });
      setDeleting(null); setNotice("دسته‌بندی حذف شد و خرج‌ها به سایر منتقل شدن."); setRevision(n => n + 1);
    } catch (err) { setFormError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="management-locations management-categories" aria-labelledby="categories-heading">
    <div className="management-overview"><span className="management-symbol"><Tags size={24} aria-hidden="true" /></span><div><h2 id="categories-heading">دسته‌بندی‌های خرج</h2><p>خرج‌های خانواده رو مرتب‌تر ثبت کنین.</p></div></div>
    <div className="management-body">
      {loading ? <p role="status">در حال دریافت دسته‌بندی‌ها…</p> : error ? <div role="alert"><p className="dash-error">{error}</p><Button variant="outline" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div> : items.length ? <ul className="management-list">{items.map(item => <li key={item.id}><span className="management-account-icon"><CategoryIcon name={item.icon} /></span><div className="management-account-copy"><strong>{item.name}</strong>{item.is_default && <small className="block text-muted-foreground">پیش‌فرض</small>}</div>{!item.is_default && <><Button variant="ghost" size="icon" aria-label={`ویرایش ${item.name}`} onClick={() => { setEditing(item); setIcon(item.icon); setFormError(""); setOpen(true); }}><Pencil size={18} aria-hidden="true" /></Button><Button variant="ghost" size="icon" className="management-delete" aria-label={`حذف ${item.name}`} onClick={() => { setDeleting(item); setFormError(""); }}><Trash2 size={18} aria-hidden="true" /></Button></>}</li>)}</ul> : <div className="management-empty"><span className="management-empty-icon"><Tags size={32} aria-hidden="true" /></span><h3>اولین دسته‌بندی رو اضافه کنین</h3><p>مثلاً خرید خونه، رفت‌وآمد یا درمان.</p></div>}
      <Button className="management-add" onClick={() => { request.current = { name: "", icon: "tag", id: "" }; setEditing(null); setIcon("tag"); setFormError(""); setNotice(""); setOpen(true); }}><Plus aria-hidden="true" />افزودن دسته‌بندی</Button>
      {notice && <p className="management-notice" role="status">{notice}</p>}
    </div>
    <Dialog open={open} onOpenChange={value => { if (!pending.current) setOpen(value); }}><DialogContent className="management-sheet" dir="rtl" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>{editing ? "ویرایش دسته‌بندی خرج" : "افزودن دسته‌بندی خرج"}</DialogTitle><DialogDescription>این دسته‌بندی موقع ثبت خرج برای همهٔ اعضای خانواده نمایش داده می‌شه.</DialogDescription></DialogHeader><form onSubmit={submit}><fieldset className="dash-form" disabled={busy}><label htmlFor="category-name">نام دسته‌بندی<input id="category-name" name="name" defaultValue={editing?.name ?? ""} required maxLength={80} placeholder="مثلاً خرید خونه" /></label><fieldset className="category-icon-picker"><legend>آیکون دسته‌بندی</legend><div className="category-icon-grid">{categoryIcons.map(({ value, label, Icon }) => <label key={value} className="category-icon-option"><input type="radio" name="icon" aria-label={label} value={value} checked={icon === value} onChange={() => setIcon(value)} /><span><Icon size={18} aria-hidden="true" /></span></label>)}</div></fieldset>{formError && <p className="dash-error" role="alert">{formError}</p>}<Button type="submit">{busy ? "در حال ثبت…" : editing ? "ذخیره تغییرات" : "افزودن دسته‌بندی"}</Button></fieldset></form></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={value => { if (!value && !pending.current) setDeleting(null); }}><DialogContent className="management-sheet" dir="rtl" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>حذف دسته‌بندی {deleting?.name}</DialogTitle><DialogDescription>همهٔ خرج‌های این دسته‌بندی به «سایر» منتقل می‌شن. مبلغ و اطلاعات خرج‌ها حفظ می‌شه.</DialogDescription></DialogHeader>{formError && <p className="dash-error" role="alert">{formError}</p>}<Button className="management-confirm-delete" disabled={busy} onClick={remove}>{busy ? "در حال حذف…" : "حذف و انتقال به سایر"}</Button><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>انصراف</Button></DialogContent></Dialog>
  </section>;
}
