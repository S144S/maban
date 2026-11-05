import { Select } from "@/components/ui/select";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, errorMessage, type User } from "./api";
import "./auth.css";
import "./account.css";

export function AdminUsersPage({ user }: { user: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => { document.title = "مدیریت کاربران | مابان"; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    api<{ users: User[]; total: number }>(`/admin/users?page=${page}&search=${encodeURIComponent(search)}`, { signal: controller.signal }).then(data => { setUsers(data.users); setTotal(data.total); }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) window.location.replace("/login");
      else setError(errorMessage(error));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, search, reload]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || pending.current) return;
    const data = new FormData(event.currentTarget); pending.current = true; setBusy(true); setSaveError("");
    try {
      await api(`/admin/users/${selected.id}`, { method: "PATCH", body: { role: data.get("role"), active: data.get("active") === "true" } });
      setSelected(null); setReload(n => n + 1); setNotice("دسترسی کاربر به‌روز شد و نشست‌های قبلی بسته شدن.");
    } catch (error) { setSaveError(errorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <main className="account-shell" dir="rtl"><header className="account-header"><h1>مدیریت کاربران</h1><a href="/account">حساب کاربری</a></header>
    <form className="auth-form" onSubmit={event => { event.preventDefault(); setPage(1); setSearch(String(new FormData(event.currentTarget).get("search") ?? "")); }}><div className="auth-field"><label htmlFor="user-search">جست‌وجوی نام یا شماره</label><input id="user-search" name="search" type="search" maxLength={80} /></div><Button type="submit">جست‌وجو</Button></form>
    <p role="status">{notice}</p>
    {loading ? <p role="status">در حال دریافت کاربران…</p> : error ? <><p role="alert">{error}</p><Button onClick={() => setReload(n => n + 1)}>تلاش دوباره</Button></> : <>
      <p>{total.toLocaleString("fa-IR")} کاربر</p>
      <ul className="account-list">{users.map(row => <li className="account-card" key={row.id}><h2>{row.first_name} {row.last_name}</h2><bdi dir="ltr">{row.phone}</bdi><p>{row.role === "admin" ? "مدیر" : "کاربر"} · {row.active ? "فعال" : "غیرفعال"}</p>{row.id === user.id ? <p className="auth-hint">حساب شما</p> : <Button variant="outline" onClick={() => { setSelected(row); setSaveError(""); }}>ویرایش دسترسی {row.first_name}</Button>}</li>)}</ul>
      {users.length === 0 && <p>کاربری پیدا نشد.</p>}
      <div className="account-actions"><Button variant="outline" disabled={page === 1} onClick={() => setPage(n => n - 1)}>قبلی</Button><span>صفحهٔ {page.toLocaleString("fa-IR")}</span><Button variant="outline" disabled={page * 20 >= total} onClick={() => setPage(n => n + 1)}>بعدی</Button></div>
    </>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !busy) setSelected(null); }}><DialogContent dir="rtl" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>ویرایش دسترسی کاربر</DialogTitle><DialogDescription>تغییر نقش یا وضعیت، نشست‌های کاربر رو می‌بنده. مدیر به فهرست کاربران و تغییر دسترسی اون‌ها دسترسی داره. حساب غیرفعال نمی‌تونه وارد بشه.</DialogDescription></DialogHeader>
      {selected && <form className="auth-form" onSubmit={save}><fieldset className="auth-fields" disabled={busy}><p>{selected.first_name} {selected.last_name} · <bdi>{selected.phone}</bdi></p>
        <div className="auth-field"><label htmlFor="user-role">نقش</label><Select id="user-role" name="role" defaultValue={selected.role} disabled={busy} options={[{ value: "user", label: "کاربر" }, { value: "admin", label: "مدیر" }]} /></div>
        <div className="auth-field"><label htmlFor="user-active">وضعیت</label><Select id="user-active" name="active" defaultValue={String(selected.active)} disabled={busy} options={[{ value: "true", label: "فعال" }, { value: "false", label: "غیرفعال" }]} /></div>
        <Button type="submit">ذخیرهٔ دسترسی</Button>{saveError && <p role="alert" className="auth-error">{saveError}</p>}
      </fieldset></form>}
    </DialogContent></Dialog>
  </main>;
}
