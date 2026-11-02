import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinanceIllustration } from "@/components/FinanceIllustration";
import { ReferenceArtwork } from "../landing/ReferenceArtwork";
import { normalizeDigits, validPhone, verifyDevelopmentOtp } from "./authValidation";
import { OtpInput } from "./OtpInput";
import "./auth.css";

const developmentOtp = import.meta.env.DEV || import.meta.env.MODE === "develop";

type Mode = "login" | "signup" | "forgot-password";
const copy = {
  login: { title: "خوش برگشتین!", description: "برای ادامه، وارد حساب مابان بشین.", action: "ورود به مابان" },
  signup: { title: "به مابان خوش اومدین", description: "یه قدم کوچیک برای حساب‌وکتاب راحت‌تر.", action: "ساخت حساب" },
  "forgot-password": { title: "رمزتون رو فراموش کردین؟", description: "شماره موبایلتون رو برای بازیابی رمز وارد کنین.", action: "درخواست بازیابی رمز" },
};

export function AuthPage() {
  const mode = window.location.pathname.replaceAll("/", "") as Mode;
  const signup = mode === "signup";
  const recovery = mode === "forgot-password";
  const [method, setMethod] = useState<"password" | "otp">("password");
  const [step, setStep] = useState<"phone" | "otp" | "password" | "done">("phone");
  const [phone, setPhone] = useState("");
  const [issuedAt, setIssuedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [attempts, setAttempts] = useState(0);
  const otpFlow = signup || recovery || method === "otp";
  const cooldown = Math.max(0, Math.ceil((issuedAt + 30000 - now) / 1000));
  useEffect(() => {
    if (step !== "otp") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);
  useEffect(() => {
    if (step === "otp") document.getElementById("otp")?.focus();
    if (step === "password") document.getElementById(signup ? "firstName" : "password")?.focus();
  }, [step, signup]);
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => { document.title = `${copy[mode].title} | مابان`; }, [mode]);
  useEffect(() => { if (feedback) feedbackRef.current?.focus(); }, [feedback]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const next: Record<string, string> = {};
    const enteredPhone = normalizeDigits(String(data.get("phone") ?? phone)).replace(/[\s-]/g, "");
    if (step === "phone" && !validPhone(enteredPhone)) next.phone = "شماره موبایل ۱۱ رقمی با ۰۹ وارد کنین.";
    if (signup && step === "password") {
      if (!String(data.get("firstName") ?? "").trim()) next.firstName = "نامتون رو وارد کنین.";
      if (!String(data.get("lastName") ?? "").trim()) next.lastName = "نام خانوادگیتون رو وارد کنین.";
    }
    const password = String(data.get("password") ?? "");
    if ((!otpFlow || step === "password") && !password) next.password = "رمز عبورتون رو وارد کنین.";
    else if (step === "password" && Array.from(password).length < 8) next.password = "رمز عبور باید حداقل ۸ نویسه داشته باشه.";
    if (step === "otp") {
      const result = verifyDevelopmentOtp(String(data.get("otp") ?? ""), developmentOtp, issuedAt, Date.now(), attempts);
      if (result) { next.otp = result; setAttempts(count => count + 1); }
    }
    setErrors(next);
    setFeedback("");
    if (Object.keys(next).length) {
      (form.elements.namedItem(Object.keys(next)[0]) as HTMLInputElement)?.focus();
      return;
    }
    if (!otpFlow) {
      if (developmentOtp) {
        window.location.replace("/dashboard");
        return;
      }
      setFeedback("ورود با رمز عبور به بک‌اند نیاز داره؛ فعلاً ورود واقعی انجام نمی‌شه.");
      return;
    }
    if (step === "phone") {
      if (!developmentOtp) {
        setFeedback("ارسال پیامک هنوز متصل نیست. لطفاً بعداً دوباره امتحان کنین.");
        return;
      }
      setPhone(enteredPhone);
      issueCode();
    } else if (step === "otp") {
      if (mode === "login") {
        window.location.replace("/dashboard");
        return;
      }
      setIssuedAt(0);
      setVisible(false);
      setStep("password");
    } else if (step === "password") {
      form.reset();
      setStep("done");
      setFeedback(recovery ? "مراحل بازیابی آزمایشی تکمیل شد؛ رمز واقعی تغییر نکرده." : "مراحل ثبت‌نام آزمایشی تکمیل شد؛ حساب واقعی ساخته نشده و رمز ذخیره نمی‌شه.");
    }
  }

  function issueCode() {
    if (!developmentOtp) return;
    const time = Date.now();
    setIssuedAt(time);
    setNow(time);
    setAttempts(0);
    setErrors({});
    setFeedback("");
    setStep("otp");
  }

  function restart() {
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

  return (
    <div className={`auth-page auth-${mode}`}>
      <a className="skip-link" href="#auth-main">رفتن به محتوای اصلی</a>
      <header className="auth-header">
        <a href="/" className="brand-link" aria-label="مابان، صفحهٔ اصلی"><ReferenceArtwork variant="brand" /></a>
        <a href="/" className="auth-back">بازگشت به خانه <ArrowRight size={18} aria-hidden="true" /></a>
      </header>
      <main id="auth-main" className="auth-layout">
        <section className="auth-form-panel" aria-labelledby="auth-title">
          <div className="auth-form-inner">
            {otpFlow && <ol className="auth-progress" aria-label="مراحل تأیید">{["شماره موبایل", "کد تأیید", ...(mode !== "login" ? ["تکمیل اطلاعات"] : [])].map((label, index) => <li key={label} aria-current={index === (step === "phone" ? 0 : step === "otp" ? 1 : 2) ? "step" : undefined}><span />{label}</li>)}</ol>}
            <div className="auth-heading">
              <h1 id="auth-title">{step === "otp" ? "فقط پنج رقم!" : step === "password" ? signup ? "بیشتر آشنا بشیم" : "یه رمز تازه" : step === "done" ? "همه‌چیز آماده‌ست" : copy[mode].title}</h1>
              <p>{step === "otp" ? "یه قدم دیگه تا ادامهٔ مسیر." : step === "password" ? "اطلاعاتتون رو اینجا کامل کنین." : step === "done" ? "می‌تونین داشبورد نمونه رو امتحان کنین." : copy[mode].description}</p>
            </div>
            {step === "phone" && <FinanceIllustration compact />}
            {mode === "login" && step === "phone" && <div className="auth-method" role="group" aria-label="روش ورود">
              <Button type="button" variant={method === "password" ? "default" : "outline"} aria-pressed={method === "password"} onClick={() => { restart(); setMethod("password"); }}>رمز عبور</Button>
              <Button type="button" variant={method === "otp" ? "default" : "outline"} aria-pressed={method === "otp"} onClick={() => { restart(); setMethod("otp"); }}>رمز یک‌بارمصرف</Button>
            </div>}
            <form key={`${step}-${method}-${issuedAt}`} noValidate onSubmit={submit} className="auth-form">
              {step === "phone" && <div className="auth-field">
                <label htmlFor="phone">شماره موبایل</label>
                <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" dir="ltr" placeholder="09123456789" defaultValue={phone} required maxLength={20} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined} onChange={() => clearField("phone")} />
                {errors.phone && <p id="phone-error" className="auth-error">{errors.phone}</p>}
              </div>}
              {step === "otp" && <>
                <p className="auth-hint">کد تأیید شماره <bdi dir="ltr">{phone}</bdi> رو وارد کنین. با وارد کردن رقم پنجم، کد خودکار بررسی می‌شه.</p>
                <div className="auth-field">
                  <label htmlFor="otp">کد تأیید ۵ رقمی</label>
                  <OtpInput invalid={!!errors.otp} onChange={() => clearField("otp")} />
                  {errors.otp && <p id="otp-error" className="auth-error">{errors.otp}</p>}
                  <p id="otp-hint" className="auth-hint">اعتبار کد: ۲ دقیقه. در محیط توسعه کد <bdi dir="ltr">12345</bdi> است؛ پیامکی ارسال نمی‌شه.</p>
                </div>
                <div className="auth-code-actions">
                  <Button type="button" variant="ghost" onClick={restart}>ویرایش شماره</Button>
                  <Button type="button" variant="ghost" disabled={cooldown > 0} onClick={issueCode}>{cooldown > 0 ? `دریافت دوباره (${cooldown.toLocaleString("fa-IR")})` : "دریافت دوباره کد"}</Button>
                </div>
              </>}
              {signup && step === "password" && <>
                <div className="auth-field">
                  <label htmlFor="firstName">نام</label>
                  <input id="firstName" name="firstName" autoComplete="given-name" required aria-invalid={!!errors.firstName} aria-describedby={errors.firstName ? "firstName-error" : undefined} onChange={() => clearField("firstName")} />
                  {errors.firstName && <p id="firstName-error" className="auth-error">{errors.firstName}</p>}
                </div>
                <div className="auth-field">
                  <label htmlFor="lastName">نام خانوادگی</label>
                  <input id="lastName" name="lastName" autoComplete="family-name" required aria-invalid={!!errors.lastName} aria-describedby={errors.lastName ? "lastName-error" : undefined} onChange={() => clearField("lastName")} />
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
              {mode === "login" && step === "phone" && method === "password" && <>
                {developmentOtp && <p className="auth-hint">در محیط توسعه، با شمارهٔ معتبر و هر رمز غیرخالی وارد داشبورد نمونه می‌شین؛ رمز بررسی نمی‌شه و ورود واقعی انجام نمی‌شه.</p>}
                <a className="auth-forgot" href="/forgot-password">رمزتون رو فراموش کردین؟</a>
              </>}
              {step !== "done" && <Button type="submit" size="lg" className="auth-submit">{step === "otp" ? "تأیید کد و ادامه" : step === "password" ? recovery ? "ثبت رمز جدید" : "تکمیل ثبت‌نام" : otpFlow ? "دریافت کد تأیید" : "ورود به مابان"}<ArrowLeft aria-hidden="true" /></Button>}
              {step === "done" && <><Button asChild><a href="/dashboard">دیدن داشبورد نمونه</a></Button><Button type="button" variant="outline" onClick={restart}>شروع دوباره</Button></>}
              <div role="status" aria-live="polite" tabIndex={-1} ref={feedbackRef} className={feedback ? "auth-feedback" : undefined}>{feedback}</div>
            </form>
            <p className="auth-alternative">{recovery ? <a href="/login"><ArrowRight size={17} aria-hidden="true" />بازگشت به ورود</a> : <>{signup ? "حساب دارین؟" : "هنوز حساب ندارین؟"} <a href={signup ? "/login" : "/signup"}>{signup ? "وارد بشین" : "ثبت‌نام کنین"}</a></>}</p>
            <div className="auth-preview"><Info size={18} aria-hidden="true" /><p>این صفحه پیش‌نمایش طراحیه؛ ورود و ساخت حساب هنوز فعال نیست. اطلاعات فرم ارسال یا ذخیره نمی‌شه.</p></div>
          </div>
        </section>
      </main>
      <footer className="auth-footer">مابان؛ همراه حساب‌وکتاب شما <span aria-hidden="true">🌱</span></footer>
    </div>
  );
}
