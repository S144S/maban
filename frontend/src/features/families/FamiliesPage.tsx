import { SquirrelFamily } from "./SquirrelFamily";
import { useActiveFamily } from "./ActiveFamily";
import { Select } from "@/components/ui/select";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Users, UserPlus, Plus, Copy, Mail, Trash2, Check } from "lucide-react";
import { AccountMenu } from "../auth/AccountMenu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, errorMessage } from "@/lib/http";
import { ReferenceArtwork } from "../landing/ReferenceArtwork";
import type { User } from "../auth/api";
import { authHref } from "../auth/navigation";
import { relationships, invitationStatus, type Family, type Member, type Invitation } from "./api";
import "../auth/auth.css";
import "../auth/account.css";
import "./families.css";

export function FamiliesPage({ user }: { user: User }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const { selected, setSelected } = useActiveFamily();
  const [detail, setDetail] = useState<{family: Family; members: Member[]} | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [modal, setModal] = useState<"create" | "invite" | null>(null);
  const [modalError, setModalError] = useState("");
  const [link, setLink] = useState("");
  const [reload, setReload] = useState(0);
  const canCreate = !families.some(f => f.owner_id === user.id);
  function report(err: unknown) {
    if (err instanceof ApiError && err.status === 401) window.location.replace(authHref("/login"));
    return errorMessage(err);
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api<{families: Family[]}>("/families", { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      setFamilies(data.families);
      setSelected(current => data.families.some(f => f.id === current) ? current : data.families[0]?.id ?? "");
    }).catch(err => { if (!controller.signal.aborted) setError(report(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    setDetail(null); setInvites([]);
    if (!selected) return;
    const controller = new AbortController();
    setDetailLoading(true);
    api<{family: Family; members: Member[]}>(`/families/${selected}`, { signal: controller.signal }).then(async data => {
      const list = (await api<{invitations: Invitation[]}>(`/families/${selected}/invitations`, {signal: controller.signal})).invitations;
      if (!controller.signal.aborted) { setDetail(data); setInvites(list); }
    }).catch(err => { if (!controller.signal.aborted) setError(report(err)); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selected, reload, user.id]);
  async function perform(action: () => Promise<void>, inModal = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setModalError(""); setError(""); setMessage("");
    try { await action(); }
    catch (err) { if (inModal) setModalError(report(err)); else setError(report(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void perform(async () => {
      if (modal === "create") {
        const result = await api<{family: Family}>("/families", {method: "POST", body: {name: String(data.get("name")).trim()}});
        setSelected(result.family.id); setModal(null); setMessage("خانواده ساخته شد؛ حالا عزیزانتون رو دعوت کنین."); setReload(n => n + 1);
      } else {
        const result = await api<{invitation: Invitation; token: string}>(`/families/${selected}/invitations`, {method: "POST", body: {relationship: data.get("relationship")}});
        setLink(`${window.location.origin}/invite#token=${result.token}`);
        setInvites(current => [result.invitation, ...current]);
      }
    }, true);
  }
  function open(next: "create" | "invite") { setModalError(""); setLink(""); setMessage(""); setModal(next); }
  return <main className="account-shell family-shell family-with-nav" dir="rtl">
    <header className="account-header"><a href="/dashboard" aria-label="مابان، داشبورد"><ReferenceArtwork variant="brand" /></a><AccountMenu /></header>
    <div className="family-page-heading"><h1>خانواده‌های من</h1><p>کنار هم، همه چی آسون‌تره <span aria-hidden="true">😊❤️</span></p></div>
    {error && <div className="family-error" role="alert"><p className="auth-error">{error}</p><Button variant="outline" disabled={busy} onClick={() => setReload(n => n + 1)}>تلاش دوباره</Button></div>}
    {message && <p role="status" className="auth-feedback">{message}</p>}
    {loading ? <p role="status">در حال دریافت خانواده‌ها…</p> : <>
      {families.length === 0 && !error && <section className="account-card family-empty"><span className="family-empty-art" aria-hidden="true"><SquirrelFamily /></span><h2>جای عزیزانتون اینجاست</h2><p>یه خانواده بسازین و همسر، فرزند یا دوستتون رو با لینک دعوت کنین.</p><Button disabled={busy} onClick={() => open("create")}><Plus aria-hidden="true" />ساخت خانواده</Button></section>}
      {canCreate && families.length > 0 && !error && <Button disabled={busy} onClick={() => open("create")}><Plus size={18} aria-hidden="true" />ساخت خانواده</Button>}
      {families.length > 0 && <section className="family-picker" aria-label="انتخاب خانواده">
        <div className="family-section-heading"><h2>خانواده‌های شما</h2></div>
        <ul className="family-picker-list">{families.map(family => <li key={family.id} className="family-combined-card">
          <button type="button" className="family-picker-card" aria-expanded={selected === family.id} aria-controls={`family-members-${family.id}`} disabled={busy} onClick={() => { if (selected !== family.id) { setDetail(null); setInvites([]); setDetailLoading(true); setMessage(""); setError(""); setSelected(family.id); } }}>
            <span className="family-avatar" aria-hidden="true"><Users size={22} /></span>
            <span className="family-picker-copy"><strong>{family.name}</strong><span>{family.owner_id === user.id ? "سازندهٔ خانواده" : "عضو خانواده"}</span></span>
            {selected === family.id && <span className="family-picker-selected"><Check size={18} aria-hidden="true" /><span>انتخاب‌شده</span></span>}
          </button>
          <div id={`family-members-${family.id}`} hidden={selected !== family.id}>
            {selected === family.id && detailLoading && <p className="family-card-loading" role="status">در حال دریافت اعضا…</p>}
            {detail?.family.id === family.id && <div className="family-card-members"><div className="family-section-heading"><h3>اعضای خانواده</h3></div>
          <ul className="family-members">{detail.members.map(member => <li key={member.user_id}><span className="family-avatar" aria-hidden="true">{Array.from(member.name)[0]}</span><div><strong>{member.name}{member.user_id === user.id ? " (شما)" : ""}</strong><p className="auth-hint">{member.user_id === detail.family.owner_id ? "سازندهٔ خانواده" : member.relationship ? relationships[member.relationship] : "عضو"}</p></div></li>)}</ul>
          {<Button disabled={busy} onClick={() => open("invite")}><UserPlus size={18} aria-hidden="true" />دعوت عضو جدید</Button>}
        </div>}
          </div>
        </li>)}</ul>
      </section>}
      {detail && <>
        {<section className="account-card family-invites-card"><div className="family-section-heading"><h2>دعوت‌ها</h2><Mail size={22} aria-hidden="true" /></div><p className="auth-hint">هر لینک برای یک نفره و ۷ روز اعتبار داره. فقط برای فرد موردنظرتون بفرستین.</p>
          {invites.length ? <ul className="account-list">{invites.map(invite => <li className="family-invitation" key={invite.id}><div><strong>دعوت {relationships[invite.relationship]}</strong><p className="auth-hint">{invitationStatus[invite.status]} · اعتبار تا {new Date(invite.expires_at).toLocaleDateString("fa-IR")}</p></div>{invite.status === "pending" && <Button variant="ghost" size="icon" className="family-revoke" title="لغو دعوت" disabled={busy} aria-label={`لغو دعوت ${relationships[invite.relationship]}`} onClick={() => void perform(async () => { await api(`/families/${selected}/invitations/${invite.id}`, {method: "DELETE"}); setInvites(current => current.map(i => i.id === invite.id ? {...i, status: "revoked"} : i)); setMessage("دعوت لغو شد و لینک دیگه قابل استفاده نیست."); })}><Trash2 size={20} aria-hidden="true" /></Button>}</li>)}</ul> : <p className="family-no-invites">هنوز دعوتی نفرستادین؛ از «دعوت عضو جدید» شروع کنین.</p>}
        </section>}
      </>}
    </>}
    <Dialog open={modal !== null} onOpenChange={value => { if (!busy && !value) setModal(null); }}><DialogContent className="family-sheet" dir="rtl" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>{modal === "create" ? "ساخت خانواده" : "دعوت عضو جدید"}</DialogTitle><DialogDescription>{modal === "create" ? "یه نام برای خانواده انتخاب کنین. مدیریت حساب‌های خانواده با شماست." : "نسبت فرد دعوت‌شده با شما رو انتخاب کنین. همهٔ اعضا به امکانات خانواده دسترسی دارن؛ بخش مدیریت فقط برای سازنده است."}</DialogDescription></DialogHeader>
      {link ? <div className="auth-form"><p>لینک آماده‌ست؛ کپی کنین و برای فرد موردنظرتون بفرستین.</p><div className="auth-field"><label htmlFor="invitation-link">لینک دعوت</label><input id="invitation-link" value={link} readOnly dir="ltr" onFocus={e => e.target.select()} /></div><Button onClick={() => void perform(async () => { try { await navigator.clipboard.writeText(link); setMessage("لینک کپی شد."); } catch { setModalError("کپی خودکار انجام نشد؛ لینک رو انتخاب و دستی کپی کنین."); } }, true)} disabled={busy}><Copy size={18} aria-hidden="true" />کپی لینک دعوت</Button><p className="auth-hint">لینک فقط همین‌بار نمایش داده می‌شه. اگه گمش کردین، دعوت قبلی رو لغو و لینک تازه بسازین.</p>{message && <p role="status">{message}</p>}</div>
      : <form onSubmit={submit} className="auth-form"><fieldset className="auth-fields" disabled={busy}>{modal === "create" ? <div className="auth-field"><label htmlFor="family-name">نام خانواده</label><input id="family-name" name="name" required maxLength={80} placeholder="مثلاً خانوادهٔ ما" /></div> : <><div className="auth-field"><label htmlFor="relationship">نسبت با شما</label><Select id="relationship" name="relationship" defaultValue="spouse" disabled={busy} options={Object.entries(relationships).map(([value, label]) => ({ value, label }))} /></div></>}<Button type="submit">{busy ? "در حال ذخیره…" : modal === "create" ? "ساخت خانواده" : "ساخت لینک دعوت"}</Button></fieldset></form>}
      {modalError && <p role="alert" className="auth-error">{modalError}</p>}
    </DialogContent></Dialog>
  </main>;
}
