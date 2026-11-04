import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError, errorMessage } from "@/lib/http";
import { invitationToken, authHref } from "../auth/navigation";
import { accessLabels, type Access, relationships, type Family, type Relationship } from "./api";
import "../auth/auth.css";
import "../auth/account.css";
import "./families.css";

type Preview = { access: Access; family: Family; relationship: Relationship; expires_at: string; accepted: boolean };
export function InvitePage() {
  const token = invitationToken();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  useEffect(() => { document.title = "دعوت به خانواده | مابان"; }, []);
  useEffect(() => {
    if (!token) { setError("لینک دعوت کامل نیست؛ از فرستنده لینک تازه بگیرین."); return; }
    const controller = new AbortController(); setError("");
    api<Preview>("/families/invitations/preview", {method: "POST", body: {token}, signal: controller.signal}).then(setPreview).catch(err => {
      if (!controller.signal.aborted) { if (err instanceof ApiError && err.status === 401) window.location.replace(authHref("/login")); else setError(errorMessage(err)); }
    });
    return () => controller.abort();
  }, [token, attempt]);
  async function accept() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await api("/families/invitations/accept", {method: "POST", body: {token}}); window.location.replace("/families"); }
    catch (err) { if (err instanceof ApiError && err.status === 401) window.location.replace(authHref("/login")); else setError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <main className="account-shell family-shell" dir="rtl"><header className="account-header"><a href="/families">خانواده‌های شما</a><a href="/dashboard">داشبورد</a></header><div className="family-heading"><span className="family-symbol" aria-hidden="true"><Users size={28} /></span><h1>دعوت به خانواده</h1></div>
    {error && <div role="alert"><p className="auth-error">{error}</p>{token && <Button variant="outline" disabled={busy} onClick={() => setAttempt(n => n + 1)}>بررسی دوباره</Button>}</div>}
    {!preview && !error && <p role="status">در حال بررسی دعوت…</p>}
    {preview && <section className="account-card"><h2>{preview.family.name}</h2><p>شما با نقش «{relationships[preview.relationship]}» دعوت شدین.</p><p className="auth-hint">با پذیرش، نام و نام خانوادگی شما برای اعضای این خانواده نمایش داده می‌شه. دسترسی شما: {accessLabels[preview.access]}.</p><p className="auth-hint">اعتبار دعوت تا {new Date(preview.expires_at).toLocaleDateString("fa-IR")}</p>{preview.accepted ? <><p role="status">شما این دعوت رو پذیرفتین.</p><Button asChild><a href="/families">دیدن خانواده</a></Button></> : <Button disabled={busy} onClick={accept}>{busy ? "در حال پیوستن…" : "پذیرش دعوت و پیوستن"}</Button>}</section>}
    <Button variant="outline" asChild><a href="/dashboard">فعلاً نه، بازگشت به داشبورد</a></Button>
  </main>;
}
