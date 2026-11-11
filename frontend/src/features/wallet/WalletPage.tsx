import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole, Wallet, CreditCard, ReceiptText, History, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { ReferenceArtwork } from "@/features/landing/ReferenceArtwork";
import { formatMoney, parseAmount } from "@/features/dashboard/model";
import { api, ApiError, errorMessage } from "@/lib/http";
import "@/features/auth/auth.css";
import "@/features/auth/account.css";
import "./wallet.css";

type Summary = { balance_toman: number; sms_price_toman: number; topup_enabled: boolean };
type Entry = { id: string; kind: "topup" | "sms" | "sms_refund"; amount_toman: number; balance_after: number; created_at: string };
type Topup = { id: string; amount_toman: number; status: "pending" | "paid"; reference: string | null; checkout_url: string | null; created_at: string };
const entryLabels = { topup: "شارژ کیف پول", sms: "رزرو هزینهٔ پیامک", sms_refund: "برگشت هزینهٔ پیامک" };
const date = (value: string) => new Date(value).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "medium", timeStyle: "short" });

export function WalletPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [entryOffset, setEntryOffset] = useState(0);
  const [topupOffset, setTopupOffset] = useState(0);
  const [moreEntries, setMoreEntries] = useState(false);
  const [moreTopups, setMoreTopups] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const request = useRef<{ amount: number; id: string } | null>(null);
  const initialPayment = useRef(new URLSearchParams(window.location.search).get("payment"));

  useEffect(() => { document.title = "کیف پول من | مابان"; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    Promise.all([
      api<Summary>("/wallet", { signal: controller.signal }),
      api<{ entries: Entry[]; has_more: boolean }>(`/wallet/entries?offset=${entryOffset}`, { signal: controller.signal }),
      api<{ topups: Topup[]; has_more: boolean }>(`/wallet/topups?offset=${topupOffset}`, { signal: controller.signal }),
    ]).then(([wallet, history, payments]) => {
      if (controller.signal.aborted) return;
      setSummary(wallet); setEntries(history.entries); setMoreEntries(history.has_more);
      setTopups(payments.topups); setMoreTopups(payments.has_more);
      if (initialPayment.current) {
        setMessage(initialPayment.current === "confirmed" ? "از درگاه برگشتین؛ نتیجهٔ تأییدشده در سوابق پرداخت‌هاست."
          : "پرداخت تأیید نشده؛ از سوابق پرداخت‌ها می‌تونین وضعیتش رو بررسی کنین.");
        initialPayment.current = null;
        window.history.replaceState(null, "", "/wallet");
      }
    }).catch(err => {
      if (controller.signal.aborted) return;
      if (err instanceof ApiError && err.status === 401) window.location.replace("/login");
      else setError(errorMessage(err));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [entryOffset, topupOffset, refresh]);

  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (err) {
      if (err instanceof ApiError && err.status === 401) window.location.replace("/login");
      else setError(errorMessage(err));
    } finally { pending.current = false; setBusy(false); }
  }
  function charge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseAmount(String(new FormData(event.currentTarget).get("amount")));
    if (!amount || amount < 10000 || amount > 10000000) {
      setError("مبلغ شارژ باید بین ۱۰٬۰۰۰ تا ۱۰٬۰۰۰٬۰۰۰ تومان باشه."); return;
    }
    if (request.current?.amount !== amount) request.current = { amount, id: crypto.randomUUID() };
    const requestId = request.current.id;
    void perform(async () => {
      const result = await api<Topup>("/wallet/topups", { method: "POST", body: { amount_toman: amount, request_id: requestId } });
      if (result.status === "paid") { request.current = null; setMessage("این شارژ قبلاً تأیید شده و به موجودی اضافه شده."); setRefresh(n => n + 1); return; }
      if (result.checkout_url) window.location.assign(result.checkout_url);
    });
  }
  return <main className="account-shell account-page credit-wallet-page" dir="rtl">
    <header className="account-header"><a href="/dashboard" aria-label="مابان، داشبورد"><ReferenceArtwork variant="brand" /></a><a href="/account" className="account-back" aria-label="بازگشت به حساب کاربری" title="بازگشت به حساب کاربری"><ArrowLeft size={22} aria-hidden="true" /></a></header>
    <div className="account-intro"><h1>کیف پول من</h1><p className="credit-wallet-scope"><LockKeyhole size={16} aria-hidden="true" />شخصی؛ برای خدمات مابان</p></div>
    {error && <div role="alert" className="credit-wallet-error"><p>{error}</p><Button variant="outline" disabled={busy || loading} onClick={() => setRefresh(n => n + 1)}>دریافت دوبارهٔ اطلاعات</Button></div>}
    {message && <p role="status" className="auth-feedback">{message}</p>}
    {loading && <p role="status">در حال دریافت اطلاعات کیف پول…</p>}
    {summary && <>
      <section className="account-card credit-wallet-overview" aria-label="موجودی کیف پول" aria-busy={loading}>
        <div className="account-section-title"><span className="account-symbol"><Wallet size={22} aria-hidden="true" /></span><h2>موجودی قابل استفاده</h2></div>
        <p className="credit-wallet-balance"><bdi>{formatMoney(summary.balance_toman)}</bdi> <small>تومان</small></p>
        <p className="credit-wallet-tariff"><MessageSquare size={18} aria-hidden="true" />{summary.sms_price_toman > 0 ? `هر پیامک یادآوری: ${formatMoney(summary.sms_price_toman)} تومان` : "تعرفهٔ پیامک یادآوری هنوز تعیین نشده."}</p>
        {summary.sms_price_toman > 0 && summary.balance_toman < summary.sms_price_toman && <p className="credit-wallet-warning">موجودی برای پیامک یادآوری کافی نیست؛ برای ارسال یادآوری‌های بعدی کیف پولتون رو شارژ کنین.</p>}
      </section>
      <section className="account-card credit-wallet-charge" aria-labelledby="credit-wallet-charge"><div className="account-section-title"><CreditCard size={22} aria-hidden="true" /><h2 id="credit-wallet-charge">شارژ کیف پول</h2></div>
        {!summary.topup_enabled && <p role="status" className="credit-wallet-notice">شارژ آنلاین هنوز فعال نشده؛ کمی بعد دوباره سر بزنین.</p>}
        <form className="auth-form" onSubmit={charge} aria-busy={busy}><fieldset className="auth-fields" disabled={busy || loading || !summary.topup_enabled}>
          <div className="auth-field"><label htmlFor="credit-wallet-amount">مبلغ شارژ (تومان)</label><MoneyInput id="credit-wallet-amount" name="amount" required defaultValue="۵۰٬۰۰۰" maxLength={14} aria-describedby="credit-wallet-amount-hint" /></div>
          <p id="credit-wallet-amount-hint" className="credit-wallet-muted">از ۱۰٬۰۰۰ تا ۱۰٬۰۰۰٬۰۰۰ تومان. موجودی بعد از تأیید درگاه اضافه می‌شه.</p>
          <Button type="submit">{busy ? "در حال بررسی…" : "شارژ از طریق درگاه"}</Button>
        </fieldset></form>
      </section>
      <section className="account-card" aria-labelledby="credit-wallet-payments" aria-busy={loading}><div className="account-section-title"><CreditCard size={22} aria-hidden="true" /><h2 id="credit-wallet-payments">سوابق پرداخت‌ها</h2></div>
        {!loading && !topups.length && <p className="credit-wallet-muted">هنوز درخواست شارژی ثبت نکردین.</p>}
        <ul className="credit-wallet-list">{topups.map(t => <li key={t.id}>
          <div className="credit-wallet-row"><strong>{formatMoney(t.amount_toman)} تومان</strong><span className="credit-wallet-status" data-paid={t.status === "paid"}>{t.status === "paid" ? "تأیید شده" : "تأیید نشده"}</span></div>
          <time dateTime={t.created_at} className="credit-wallet-muted">{date(t.created_at)}</time>
          {t.reference && <p>شمارهٔ پیگیری: <bdi dir="ltr">{t.reference}</bdi></p>}
          {t.status === "pending" && <Button variant="outline" disabled={busy || loading} onClick={() => void perform(async () => {
            await api(`/wallet/topups/${t.id}/verify`, { method: "POST" });
            setMessage("پرداخت تأیید شد و موجودی به‌روز شد."); setRefresh(n => n + 1);
          })}>بررسی وضعیت پرداخت</Button>}
        </li>)}</ul>
        <Pagination offset={topupOffset} more={moreTopups} disabled={busy || loading} onChange={setTopupOffset} label="پرداخت‌ها" />
      </section>
      <section className="account-card" aria-labelledby="credit-wallet-history" aria-busy={loading}><div className="account-section-title"><History size={22} aria-hidden="true" /><h2 id="credit-wallet-history">ریز تراکنش‌ها</h2></div>
        {!loading && !entries.length && <p className="credit-wallet-muted">هنوز تراکنشی ندارین؛ اولین شارژ اینجا ثبت می‌شه.</p>}
        <ul className="credit-wallet-list">{entries.map(e => <li key={e.id}>
          <div className="credit-wallet-row"><strong>{entryLabels[e.kind]}</strong><span><bdi>{formatMoney(e.amount_toman)}</bdi> تومان</span></div>
          <time dateTime={e.created_at} className="credit-wallet-muted">{date(e.created_at)}</time>
          <p className="credit-wallet-muted">موجودی پس از تراکنش: {formatMoney(e.balance_after)} تومان</p>
        </li>)}</ul>
        <Pagination offset={entryOffset} more={moreEntries} disabled={busy || loading} onChange={setEntryOffset} label="تراکنش‌ها" />
      </section>
      <details className="account-card credit-wallet-policy"><summary><ReceiptText size={20} aria-hidden="true" />دربارهٔ مصرف موجودی</summary><div>
        <p>فعلاً موجودی برای پیامک یادآوری مصرف می‌شه. پیامک ورود رایگانه. امکان برداشت یا انتقال موجودی وجود نداره.</p>
        <p>هزینهٔ پیامک قبل از ارسال رزرو می‌شه. اگه ارسال لغو یا قطعی رد بشه، مبلغ برمی‌گرده. در وضعیت نامشخص، مبلغ تا بررسی پشتیبانی رزرو می‌مونه. یادآوری‌های ردشده به‌خاطر کمبود موجودی، بعد از شارژ دوباره ارسال نمی‌شن.</p>
      </div></details>
    </>}
  </main>;
}

function Pagination({ offset, more, disabled, onChange, label }: { offset: number; more: boolean; disabled: boolean; onChange: (offset: number) => void; label: string }) {
  if (!offset && !more) return null;
  return <nav className="credit-wallet-row" aria-label={`صفحه‌های ${label}`}><Button variant="outline" disabled={disabled || !offset} onClick={() => onChange(Math.max(0, offset - 50))}>قبلی</Button><Button variant="outline" disabled={disabled || !more} onClick={() => onChange(offset + 50)}>بعدی</Button></nav>;
}
