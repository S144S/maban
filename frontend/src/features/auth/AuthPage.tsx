import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FinanceIllustration } from "@/components/FinanceIllustration";
import { ReferenceArtwork } from "../landing/ReferenceArtwork";
import { afterAuth, authHref } from "./navigation";
import { normalizeDigits, validPhone } from "./authValidation";
import { OtpInput } from "./OtpInput";
import { api, ApiError, errorMessage, type User } from "./api";
import "./auth.css";


type Mode = "login" | "signup" | "forgot-password";
const copy = {
  login: { title: "خوش برگشتین!", description: "برای ادامه، وارد حساب مابان بشین.", action: "ورود" },
  signup: { title: "به مابان خوش اومدین", description: "یه قدم کوچیک برای حساب‌وکتاب راحت‌تر.", action: "ساخت حساب" },
  "forgot-password": { title: "رمزتون رو فراموش کردین؟", description: "شماره موبایلتون رو برای بازیابی رمز وارد کنین.", action: "درخواست بازیابی رمز" },
};

export function AuthPage() {
  const mode = window.location.pathname.replaceAll("/", "") as Mode;
  const signup = mode === "signup";
  const recovery = mode === "forgot-password";
  const modalOtp = !recovery;
  const [method, setMethod] = useState<"password" | "otp">("password");
  const [step, setStep] = useState<"phone" | "otp" | "password" | "done">("phone");
  const [otpOpen, setOtpOpen] = useState(false);
  const editPhoneRef = useRef(false);
  const [phone, setPhone] = useState("");
  const [issuedAt, setIssuedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [challenge, setChallenge] = useState("");
  const [proof, setProof] = useState("");
  const [developmentOtp, setDevelopmentOtp] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const otpFlow = signup || recovery || method === "otp";
  const cooldown = Math.max(0, Math.ceil((issuedAt + 30000 - now) / 1000));
  useEffect(() => {
    if (!issuedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [issuedAt]);
  useEffect(() => {
    if (busy) return;
    if (step === "otp" || otpOpen) document.getElementById("otp")?.focus();
    if (step === "password") document.getElementById(signup ? "firstName" : "password")?.focus();
  }, [step, signup, busy, otpOpen]);
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState(new URLSearchParams(window.location.search).get("password") === "changed" ? "رمز تغییر کرد؛ با رمز جدید وارد بشین." : "");
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => { document.title = `${copy[mode].title} | مابان`; }, [mode]);
  useEffect(() => { if (feedback) feedbackRef.current?.focus(); }, [feedback]);

  async function submit(event: FormEvent<HTMLFormElement>, submissionStep = step) {
    event.preventDefault();
    if (busyRef.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const next: Record<string, string> = {};
    const enteredPhone = normalizeDigits(String(data.get("phone") ?? phone)).replace(/[\s-]/g, "");
    if (submissionStep === "phone" && !validPhone(enteredPhone)) next.phone = "شماره موبایل ۱۱ رقمی با ۰۹ وارد کنین.";
    if (signup && submissionStep === "password") {
      if (!String(data.get("firstName") ?? "").trim()) next.firstName = "نامتون رو وارد کنین.";
      if (!String(data.get("lastName") ?? "").trim()) next.lastName = "نام خانوادگیتون رو وارد کنین.";
    }
    const password = String(data.get("password") ?? "");
    if ((!otpFlow || submissionStep === "password") && !password) next.password = "رمز عبورتون رو وارد کنین.";
    else if (submissionStep === "password" && (Array.from(password).length < 8 || Array.from(password).length > 128)) next.password = "رمز عبور باید بین ۸ تا ۱۲۸ نویسه داشته باشه.";
    const code = normalizeDigits(String(data.get("otp") ?? ""));
    if (submissionStep === "otp" && !/^\d{5}$/.test(code)) next.otp = "کد ۵ رقمی رو کامل وارد کنین.";
    setErrors(next);
    setFeedback("");
    if (Object.keys(next).length) {
      (form.elements.namedItem(Object.keys(next)[0]) as HTMLInputElement)?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      if (!otpFlow) {
        await api("/auth/login", { method: "POST", body: { phone: enteredPhone, password } });
        window.location.assign(afterAuth());
      } else if (submissionStep === "phone") {
        setPhone(enteredPhone);
        if (modalOtp && challenge && cooldown > 0) setOtpOpen(true);
        else await issueCode(enteredPhone);
      } else if (submissionStep === "otp") {
        const result = await api<{ user?: User; proof?: string }>("/auth/otp/verify", { method: "POST", body: { challenge_id: challenge, code } });
        if (mode === "login" && result.user) window.location.assign(afterAuth());
        else if (result.proof) { setProof(result.proof); setOtpOpen(false); setIssuedAt(0); setVisible(false); setStep("password"); }
      } else if (submissionStep === "password") {
        if (signup) {
          await api("/auth/register", { method: "POST", body: { proof, password, first_name: String(data.get("firstName")).trim(), last_name: String(data.get("lastName")).trim() } });
          window.location.assign(afterAuth());
        } else {
          await api("/auth/reset-password", { method: "POST", body: { proof, password } });
          form.reset(); setStep("done"); setFeedback("رمز عبور تغییر کرد؛ با رمز جدید وارد بشین.");
        }
      }
    } catch (error) {
      if (submissionStep === "otp") setErrors({ otp: errorMessage(error) });
      else setFeedback(errorMessage(error));
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function issueCode(number = phone) {
    try {
      const result = await api<{ challenge_id: string; retry_after: number; development: boolean }>("/auth/otp/request", {
        method: "POST", body: { phone: number, purpose: signup ? "signup" : recovery ? "recovery" : "login" },
      });
      setChallenge(result.challenge_id);
      setDevelopmentOtp(result.development);
      setIssuedAt(Date.now()); setNow(Date.now());
      setErrors({}); setFeedback("");
      if (modalOtp) setOtpOpen(true); else setStep("otp");
    } catch (error) {
      if (error instanceof ApiError && error.retryAfter) {
        setIssuedAt(Date.now() + (error.retryAfter - 30) * 1000); setNow(Date.now());
      }
      throw error;
    }
  }

  async function resend() {
    if (busyRef.current || cooldown > 0) return;
    busyRef.current = true; setBusy(true);
    try { await issueCode(); } catch (error) { setFeedback(errorMessage(error)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function restart() {
    if (busyRef.current) return;
    setChallenge(""); setProof("");
    setStep("phone");
    setIssuedAt(0);
    setErrors({});
    setFeedback("");
    setVisible(false);
  }

  function clearField(name: string) {
    setErrors(current => ({ ...current, [name]: "" }));
    setFeedback("");
  }

  function closeOtp() {
    if (busyRef.current) return;
    setOtpOpen(false);
    setErrors({});
    setFeedback("");
  }

  const otpFields = (
    <>
      <p className="auth-hint">کد تأیید شماره <bdi dir="ltr">{phone}</bdi> رو وارد کنین. با وارد کردن رقم پنجم، کد خودکار بررسی می‌شه.</p>
      <div className="auth-field">
        <label htmlFor="otp">کد تأیید ۵ رقمی</label>
        <OtpInput key={issuedAt} invalid={!!errors.otp} onChange={() => clearField("otp")} />
        {errors.otp && <p id="otp-error" className="auth-error" role="alert">{errors.otp}</p>}
        <p id="otp-hint" className="auth-hint">اعتبار کد: ۲ دقیقه.{developmentOtp && <> در محیط توسعه کد <bdi dir="ltr">12345</bdi> است؛ پیامکی ارسال نمی‌شه.</>}</p>
      </div>
      <div className="auth-code-actions">
        <Button type="button" variant="ghost" onClick={() => {
          if (modalOtp) { editPhoneRef.current = true; closeOtp(); }
          else restart();
        }}>ویرایش شماره</Button>
        <Button type="button" variant="ghost" disabled={busy || cooldown > 0} onClick={resend}>{cooldown > 0 ? `دریافت دوباره (${cooldown.toLocaleString("fa-IR")})` : "دریافت دوباره کد"}</Button>
      </div>
    </>
  );

  return (
    <div className={`auth-page auth-${mode}`}>
      <a className="skip-link" href="#auth-main">رفتن به محتوای اصلی</a>
      <header className="auth-header">
        <a href="/" className="brand-link" aria-label="مابان، صفحهٔ اصلی"><ReferenceArtwork variant="brand" /></a>
        {mode !== "login" && <a href="/" className="auth-back">بازگشت به خانه <ArrowRight size={18} aria-hidden="true" /></a>}
      </header>
      <main id="auth-main" className="auth-layout">
        <section className="auth-form-panel" aria-labelledby="auth-title">
          <div className="auth-form-inner">
            <div className="auth-heading">
              <h1 id="auth-title">{step === "otp" ? "فقط پنج رقم!" : step === "password" ? signup ? "بیشتر آشنا بشیم" : "یه رمز تازه" : step === "done" ? "همه‌چیز آماده‌ست" : copy[mode].title}</h1>
              <p>{step === "otp" ? "یه قدم دیگه تا ادامهٔ مسیر." : step === "password" ? "اطلاعاتتون رو اینجا کامل کنین." : step === "done" ? "حالا می‌تونین وارد حسابتون بشین." : copy[mode].description}</p>
            </div>
            {step === "phone" && <FinanceIllustration compact />}
            {mode === "login" && step === "phone" && <div className="auth-method" role="group" aria-label="روش ورود">
              <Button type="button" disabled={busy} variant={method === "password" ? "default" : "outline"} aria-pressed={method === "password"} onClick={() => { restart(); setMethod("password"); }}>رمز عبور</Button>
              <Button type="button" disabled={busy} variant={method === "otp" ? "default" : "outline"} aria-pressed={method === "otp"} onClick={() => { restart(); setMethod("otp"); }}>رمز یک‌بارمصرف</Button>
            </div>}
            <form key={`${step}-${method}-${mode === "login" ? "login" : issuedAt}`} noValidate onSubmit={event => submit(event)} className="auth-form" aria-busy={busy}>
              <fieldset disabled={busy} className="auth-fields">
              {step === "phone" && <div className="auth-field">
                <label htmlFor="phone">شماره موبایل</label>
                <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" dir="ltr" placeholder="09123456789" value={phone} required maxLength={20} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined} onChange={event => { setPhone(event.target.value); setIssuedAt(0); setChallenge(""); clearField("phone"); }} />
                {errors.phone && <p id="phone-error" className="auth-error">{errors.phone}</p>}
              </div>}
              {step === "otp" && otpFields}
              {signup && step === "password" && <>
                <div className="auth-field">
                  <label htmlFor="firstName">نام</label>
                  <input id="firstName" name="firstName" autoComplete="given-name" maxLength={80} required aria-invalid={!!errors.firstName} aria-describedby={errors.firstName ? "firstName-error" : undefined} onChange={() => clearField("firstName")} />
                  {errors.firstName && <p id="firstName-error" className="auth-error">{errors.firstName}</p>}
                </div>
                <div className="auth-field">
                  <label htmlFor="lastName">نام خانوادگی</label>
                  <input id="lastName" name="lastName" autoComplete="family-name" maxLength={80} required aria-invalid={!!errors.lastName} aria-describedby={errors.lastName ? "lastName-error" : undefined} onChange={() => clearField("lastName")} />
                  {errors.lastName && <p id="lastName-error" className="auth-error">{errors.lastName}</p>}
                </div>
              </>}
              {((step === "phone" && !otpFlow) || step === "password") && <div className="auth-field">

                <label htmlFor="password">{step === "password" ? "رمز عبور جدید" : "رمز عبور"}</label>
                <div className="auth-password">
                  <input id="password" name="password" type={visible ? "text" : "password"} autoComplete={step === "password" ? "new-password" : "current-password"} dir="ltr" required aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : step === "password" ? "password-hint" : undefined} onChange={() => clearField("password")} />
                  <button type="button" aria-label={visible ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                </div>
                {errors.password ? <p id="password-error" className="auth-error">{errors.password}</p> : step === "password" && <p id="password-hint" className="auth-hint">حداقل ۸ نویسه؛ بهتره ترکیبی از حروف و عدد باشه.</p>}
              </div>}
              {step !== "done" && <Button id="auth-submit" type="submit" size="lg" className="auth-submit">{step === "otp" ? "تأیید کد و ادامه" : step === "password" ? recovery ? "ثبت رمز جدید" : "تکمیل ثبت‌نام" : otpFlow ? "دریافت کد تأیید" : "ورود"}<ArrowLeft aria-hidden="true" /></Button>}
              {step === "done" && <><Button asChild><a href="/login">ورود</a></Button><Button type="button" variant="outline" onClick={restart}>شروع دوباره</Button></>}
              {step === "password" && <Button type="button" variant="ghost" onClick={restart}>شروع دوبارهٔ تأیید شماره</Button>}
              {!otpOpen && <div role="status" aria-live="polite" tabIndex={-1} ref={feedbackRef} className={feedback ? "auth-feedback" : undefined}>{feedback}</div>}
              </fieldset>
            </form>
            <p className="auth-alternative">{recovery ? <a href="/login"><ArrowRight size={17} aria-hidden="true" />بازگشت به ورود</a> : <>{signup ? "حساب دارین؟" : "هنوز حساب ندارین؟"} <a href={authHref(signup ? "/login" : "/signup")}>{signup ? "وارد بشین" : "ثبت‌نام کنین"}</a></>}</p>
          </div>
        </section>
      </main>
      {modalOtp && <Dialog open={otpOpen} onOpenChange={open => { if (!open) closeOtp(); }}>
        <DialogContent dir="rtl" showCloseButton={!busy} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }} onOpenAutoFocus={event => {
          event.preventDefault();
          document.getElementById("otp")?.focus();
        }} onCloseAutoFocus={event => {
          event.preventDefault();
          document.getElementById(step === "password" ? "firstName" : editPhoneRef.current ? "phone" : "auth-submit")?.focus();
          editPhoneRef.current = false;
        }}>
          <DialogHeader>
            <DialogTitle>{signup ? "کد تأیید ۵ رقمی" : "کد ورود ۵ رقمی"}</DialogTitle>
            <DialogDescription>کد یک‌بارمصرف رو برای ادامه وارد کنین.</DialogDescription>
          </DialogHeader>
          <form noValidate onSubmit={event => submit(event, "otp")} className="auth-form" aria-busy={busy}>
              <fieldset disabled={busy} className="auth-fields">
            {otpFields}
            <Button type="submit" size="lg" className="auth-submit">تأیید کد و ادامه<ArrowLeft aria-hidden="true" /></Button>
            <div role="status" aria-live="polite" tabIndex={-1} ref={otpOpen ? feedbackRef : undefined} className={feedback ? "auth-feedback" : undefined}>{feedback}</div>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>}
      <footer className="auth-footer">مابان؛ همراه حساب‌وکتاب شما <span aria-hidden="true">🌱</span></footer>
    </div>
  );
}
