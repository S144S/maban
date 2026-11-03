import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ChevronLeft, Users, ShieldCheck, UserRound, Smartphone, LogOut, KeyRound, BadgeCheck } from "lucide-react";
import { AccountAvatar } from "@/components/AccountAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReferenceArtwork } from "../landing/ReferenceArtwork";
import { api, ApiError, errorMessage, type User } from "./api";
import "./auth.css";
import "./account.css";

type Session = { id: string; current: boolean; created_at: string; expires_at: string; user_agent: string };

export function AccountPage({ user: initialUser }: { user: User }) {
  const [user, setUser] = useState(initialUser);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { document.title = "حساب کاربری | مابان"; }, []);
  useEffect(() => { if (message) feedback.current?.focus(); }, [message]);

  function report(error: unknown) {
    if (error instanceof ApiError && error.status === 401) window.location.replace("/login");
    return errorMessage(error);
  }
  async function loadSessions() {
    try { setSessions((await api<{ sessions: Session[] }>("/users/me/sessions")).sessions); setSessionError(""); }
    catch (error) { setSessionError(report(error)); }
  }
  useEffect(() => { void loadSessions(); }, []);

  async function perform(action: () => Promise<void>, password = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage(""); setPasswordError("");
    try { await action(); } catch (error) { if (password) setPasswordError(report(error)); else setMessage(report(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void perform(async () => {
      const result = await api<{ user: User }>("/users/me", { method: "PATCH", body: { first_name: String(data.get("first_name")).trim(), last_name: String(data.get("last_name")).trim() } });
      setUser(result.user); setMessage("اطلاعات حسابتون ذخیره شد.");
    });
  }
  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirm")) { setPasswordError("تکرار رمز با رمز جدید یکی نیست."); return; }
    void perform(async () => {
      await api("/users/me/password", { method: "POST", body: { current_password: data.get("current_password"), password: data.get("password") } });
      window.location.replace("/login?password=changed");
    }, true);
  }
  return <main className="account-shell account-page" dir="rtl">
    <header className="account-header"><a href="/dashboard" aria-label="مابان، داشبورد"><ReferenceArtwork variant="brand" /></a><a className="account-back" href="/dashboard" aria-label="بازگشت به داشبورد" title="بازگشت به داشبورد"><ArrowLeft size={22} aria-hidden="true" /></a></header>
    <div className="account-intro"><h1>حساب کاربری</h1><p>اطلاعات و امنیت حسابتون، یک‌جا.</p></div>
    <section className="account-summary" aria-label="خلاصهٔ حساب">
      <span className="account-avatar"><AccountAvatar /></span>
      <div><h2>{user.first_name} {user.last_name}</h2><p><bdi dir="ltr">{user.phone.replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])}</bdi></p><span className="account-verified"><BadgeCheck size={16} aria-hidden="true" />شمارهٔ تأییدشده</span></div>
    </section>
    <a className="account-family" href="/families"><span className="account-symbol"><Users size={22} aria-hidden="true" /></span><span><strong>خانوادهٔ شما</strong><small>مدیریت خانواده و دعوت اعضا</small></span><ChevronLeft size={20} aria-hidden="true" /></a>
    <section className="account-card account-profile" aria-labelledby="profile-title"><div className="account-section-title"><UserRound size={22} aria-hidden="true" /><h2 id="profile-title">اطلاعات شما</h2></div>
      <form className="auth-form" onSubmit={saveProfile} aria-busy={busy}><fieldset className="auth-fields" disabled={busy}>
        <div className="auth-field"><label htmlFor="first-name">نام</label><input id="first-name" name="first_name" autoComplete="given-name" defaultValue={user.first_name} required maxLength={80} /></div>
        <div className="auth-field"><label htmlFor="last-name">نام خانوادگی</label><input id="last-name" name="last_name" autoComplete="family-name" defaultValue={user.last_name} required maxLength={80} /></div>
        <Button type="submit">{busy ? "در حال انجام…" : "ذخیرهٔ اطلاعات"}</Button>
      </fieldset></form>
    </section>
    <section className="account-card account-security" aria-labelledby="security-title"><div className="account-section-title"><ShieldCheck size={22} aria-hidden="true" /><h2 id="security-title">امنیت حساب</h2></div><p className="account-copy">رمز و دسترسی دستگاه‌هاتون رو مدیریت کنین.</p>
      <Button variant="outline" disabled={busy} onClick={() => { setPasswordError(""); setPasswordOpen(true); }}><KeyRound aria-hidden="true" />تغییر رمز عبور</Button>
      <Button variant="outline" disabled={busy} onClick={() => void perform(async () => { await api("/users/me/sessions/others", { method: "DELETE" }); await loadSessions(); setMessage("نشست‌های دیگه بسته شدن."); })}>خروج از دستگاه‌های دیگه</Button>
    </section>
    <section className="account-card account-devices" aria-labelledby="devices-title"><div className="account-section-title"><Smartphone size={22} aria-hidden="true" /><h2 id="devices-title">دستگاه‌های متصل</h2></div>
      {sessionError ? <><p role="alert">{sessionError}</p><Button variant="outline" onClick={loadSessions}>دریافت دوبارهٔ نشست‌ها</Button></> : <ul className="account-list">{sessions.map(session => <li key={session.id}>
        <div className="account-device-title"><strong>{session.current ? "این دستگاه" : "دستگاه دیگه"}</strong>{session.current && <span className="account-device-badge">نشست فعلی</span>}</div>
        <details className="account-browser"><summary>جزئیات مرورگر</summary><p className="auth-hint"><bdi dir="ltr">{session.user_agent || "مرورگر نامشخص"}</bdi></p></details>
        <p className="auth-hint">شروع: {new Date(session.created_at).toLocaleString("fa-IR")}</p>
        {!session.current && <Button variant="outline" disabled={busy} onClick={() => void perform(async () => { await api(`/users/me/sessions/${session.id}`, { method: "DELETE" }); await loadSessions(); setMessage("نشست بسته شد."); })}>بستن نشست</Button>}
      </li>)}</ul>}
    </section>
    {user.role === "admin" && <Button asChild variant="outline"><a href="/admin/users">مدیریت کاربران</a></Button>}
    <Button variant="outline" className="account-logout" disabled={busy} onClick={() => void perform(async () => { await api("/auth/logout", { method: "POST" }); window.location.replace("/login"); })}><LogOut aria-hidden="true" />خروج از حساب</Button>
    <p role="status" tabIndex={-1} ref={feedback} className={message ? "auth-feedback" : undefined}>{message}</p>
    <Dialog open={passwordOpen} onOpenChange={open => { if (!busy) setPasswordOpen(open); }}><DialogContent dir="rtl" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>تغییر رمز عبور</DialogTitle><DialogDescription>بعد از تغییر رمز، همهٔ نشست‌ها بسته می‌شن و باید دوباره وارد بشین.</DialogDescription></DialogHeader>
      <form className="auth-form" onSubmit={changePassword} aria-busy={busy}><fieldset className="auth-fields" disabled={busy}>
        <div className="auth-field"><label htmlFor="current-password">رمز فعلی</label><input id="current-password" name="current_password" type="password" autoComplete="current-password" required maxLength={128} dir="ltr" /></div>
        <div className="auth-field"><label htmlFor="new-password">رمز جدید (۸ تا ۱۲۸ نویسه)</label><input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} dir="ltr" /></div>
        <div className="auth-field"><label htmlFor="confirm-password">تکرار رمز جدید</label><input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128} dir="ltr" /></div>
        <Button type="submit">تغییر رمز و خروج</Button>
        <a href="/forgot-password">تعیین رمز با کد تأیید شماره</a>
        {passwordError && <p className="auth-error" role="alert">{passwordError}</p>}
      </fieldset></form>
    </DialogContent></Dialog>
  </main>;
}
