import { LocationField } from "../money-locations/LocationField";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { HandCoins, CreditCard, Eye, EyeOff, Wallet, TrendingUp, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api, ApiError, errorMessage } from "@/lib/http";
import type { Family, Member } from "../families/api";
import { parseAmount } from "./model";

const sources = [{ value: "salary", label: "حقوق" }, { value: "subsidy", label: "یارانه" }, { value: "voucher", label: "کالابرگ" }, { value: "gift", label: "هدیه" }];
const categories = [{ value: "home", label: "خانه" }, { value: "groceries", label: "خرید روزمره" }, { value: "leisure", label: "تفریح" }, { value: "other", label: "سایر" }];
type Wallet = { familyId: string; members: Member[]; balance: string };
type Kind = "income" | "expenses";
function report(error: unknown) {
  if (error instanceof ApiError && error.status === 401) window.location.replace("/login");
  return errorMessage(error);
}

export function FamilyWallet({ userId }: { userId: string }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [selected, setSelected] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("income");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const request = useRef({ fingerprint: "", id: "" });

  useEffect(() => {
    const refresh = () => { if (!pending.current && !open) setRevision(n => n + 1); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [open]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setWallet(null);
    async function load() {
      const result = await api<{ families: Family[] }>("/families", { signal: controller.signal });
      const familyId = result.families.find(f => f.id === selected)?.id ?? result.families[0]?.id;
      if (controller.signal.aborted) return;
      setFamilies(result.families);
      if (!familyId) return;
      const [detail, income, expenses] = await Promise.all([
        api<{ members: Member[] }>(`/families/${familyId}`, { signal: controller.signal }),
        api<{ total_toman: string }>(`/families/${familyId}/income`, { signal: controller.signal }),
        api<{ total_toman: string }>(`/families/${familyId}/expenses`, { signal: controller.signal }),
      ]);
      if (!controller.signal.aborted) setWallet({ familyId, members: detail.members, balance: (BigInt(income.total_toman) - BigInt(expenses.total_toman)).toString() });
    }
    void load().catch(err => { if (!controller.signal.aborted) setError(report(err)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, revision]);

  const canWrite = !!wallet?.members.some(m => m.user_id === userId && m.access === "full");
  function prepare(next: Kind) {
    setKind(next); setFormError(""); setNotice(""); request.current = { fingerprint: "", id: "" };
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !wallet || !canWrite) return;
    const fields = new FormData(event.currentTarget);
    const amount = parseAmount(String(fields.get("amount") ?? ""));
    if (amount === null) { setFormError("مبلغ رو به تومان و بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ وارد کنین."); return; }
    if (kind === "income" && !fields.get("location")) { setFormError("حساب مقصد رو انتخاب کنین؛ اگر حسابی ندارین، از مدیریت اضافه کنین."); return; }
    const familyId = wallet.familyId;
    const payload = {
      amount_toman: amount,
      description: String(fields.get("description") ?? "").trim() || null,
      ...(kind === "income" ? { source: fields.get("source"), location_id: fields.get("location"), from_member_id: fields.get("member") } : { title: String(fields.get("title") ?? "").trim(), category: fields.get("category"), paid_by_member_id: fields.get("member") }),
    };
    const fingerprint = JSON.stringify({ familyId, kind, payload });
    if (request.current.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setFormError("");
    try {
      await api(`/families/${familyId}/${kind}`, { method: "POST", body: { ...payload, request_id: request.current.id } });
      setOpen(false); setNotice(kind === "income" ? "دخل خانواده ثبت شد." : "خرج خانواده ثبت شد."); setRevision(n => n + 1);
    } catch (err) { setFormError(report(err)); }
    finally { pending.current = false; setBusy(false); }
  }

  const balanceLabel = wallet ? BigInt(wallet.balance).toLocaleString("fa-IR") : "";
  const activeFamily = families.find(f => f.id === (wallet?.familyId ?? selected)) ?? families[0];

  return <>
    <section className="wallet-balance" aria-label="موجودی خانواده" aria-busy={loading}>
      <div className="wallet-balance-heading"><span className="wallet-balance-icon" aria-hidden="true"><Wallet /></span><h1>موجودی خانواده{activeFamily && <> <bdi>{activeFamily.name}</bdi></>}</h1><Button variant="ghost" size="icon" className="wallet-visibility" aria-label={hidden ? "نمایش موجودی" : "پنهان کردن موجودی"} aria-pressed={hidden} onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff /> : <Eye />}</Button></div>
      {families.length > 1 && <label className="wallet-family">خانواده<Select id="wallet-family" value={wallet?.familyId ?? (families.some(f => f.id === selected) ? selected : families[0].id)} disabled={busy} onValueChange={value => { setSelected(value); setWallet(null); setLoading(true); setNotice(""); }} options={families.map(f => ({ value: f.id, label: f.name }))} /></label>}
      {loading ? <p role="status">در حال دریافت موجودی…</p> : error ? <div role="alert"><p className="dash-error">{error}</p><Button variant="ghost" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div> : wallet ? <>
        <p className={`wallet-balance-amount${!hidden && balanceLabel.length > 13 ? " wallet-balance-amount-compact" : ""}`}><bdi>{hidden ? "••••••" : balanceLabel}</bdi> <small>تومان</small></p>
        {!canWrite && <p className="dash-small">دسترسی شما فقط دیدن است.</p>}
      </> : <p>برای ثبت دخل‌وخرج، اول از <a href="/families" className="underline">صفحهٔ خانواده</a> یه خانواده بسازین یا عضو خانواده بشین.</p>}
      <p className="wallet-balance-notice" role="status">{notice}</p>
    </section>
    <Dialog open={open} onOpenChange={value => { if (!pending.current) setOpen(value); }}>
      <div className="dash-home-actions">
        <DialogTrigger asChild><Button className="home-action home-action-income" size="lg" variant="outline" disabled={!canWrite || loading || busy} onClick={() => prepare("income")}><HandCoins aria-hidden="true" /><span>دخل</span></Button></DialogTrigger>
        <DialogTrigger asChild><Button className="home-action home-action-expense" size="lg" variant="outline" disabled={!canWrite || loading || busy} onClick={() => prepare("expenses")}><CreditCard aria-hidden="true" /><span>خرج</span></Button></DialogTrigger>
        <Dialog>
          <DialogTrigger asChild><Button className="home-action home-action-investment" size="lg" variant="outline"><TrendingUp aria-hidden="true" /><span>سرمایه‌گذاری</span></Button></DialogTrigger>
          <DialogContent dir="rtl"><DialogHeader><DialogTitle>سرمایه‌گذاری</DialogTitle><DialogDescription>این بخش هنوز فعال نیست. امکان ثبت و مدیریت سرمایه‌گذاری‌ها در ادامه اضافه می‌شه.</DialogDescription></DialogHeader></DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild><Button className="home-action home-action-assets" size="lg" variant="outline"><Gem aria-hidden="true" /><span>دارایی‌ها</span></Button></DialogTrigger>
          <DialogContent dir="rtl"><DialogHeader><DialogTitle>دارایی‌ها</DialogTitle><DialogDescription>این بخش هنوز فعال نیست. امکان ثبت و مدیریت دارایی‌ها در ادامه اضافه می‌شه.</DialogDescription></DialogHeader></DialogContent>
        </Dialog>
      </div>
      <DialogContent dir="rtl" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>{kind === "income" ? "ثبت دخل" : "ثبت خرج"}</DialogTitle><DialogDescription>برای خانوادهٔ {families.find(f => f.id === wallet?.familyId)?.name} ثبت می‌شه و اعضای خانواده می‌تونن ببیننش. همهٔ مبلغ‌ها به تومان هستن.</DialogDescription></DialogHeader>
        <form onSubmit={submit}><fieldset className="dash-form" disabled={busy}>
          <label htmlFor="wallet-amount">مبلغ (تومان)<input id="wallet-amount" name="amount" inputMode="numeric" dir="ltr" required maxLength={24} /></label>
          {kind === "income" ? <label htmlFor="wallet-source">منبع درآمد<Select id="wallet-source" name="source" defaultValue="salary" options={sources} disabled={busy} required /></label> : <>
            <label htmlFor="wallet-title">عنوان خرج<input id="wallet-title" name="title" required maxLength={80} /></label>
            <label htmlFor="wallet-category">دسته‌بندی<Select id="wallet-category" name="category" defaultValue="groceries" options={categories} disabled={busy} required /></label>
          </>}
          <label htmlFor="wallet-member">{kind === "income" ? "از جانب" : "پرداخت‌کننده"}<Select id="wallet-member" name="member" defaultValue={userId} options={(wallet?.members ?? []).map(m => ({ value: m.user_id, label: m.name }))} disabled={busy} required /></label>
          {kind === "income" && wallet && <LocationField familyId={wallet.familyId} disabled={busy} />}
          <label htmlFor="wallet-description">توضیح (اختیاری)<input id="wallet-description" name="description" maxLength={500} /></label>
          {formError && <p className="dash-error" role="alert">{formError}</p>}
          <Button type="submit">{busy ? "در حال ثبت…" : kind === "income" ? "ثبت دخل" : "ثبت خرج"}</Button>
        </fieldset></form>
      </DialogContent>
    </Dialog>
  </>;
}
