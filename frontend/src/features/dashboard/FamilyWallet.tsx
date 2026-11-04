import { MoneyInput } from "@/components/ui/money-input";
import { CategoryField } from "../expenses/CategoryField";
import { PersonalFundValue } from "./PersonalFundValue";
import { AssetDialog } from "../assets/AssetDialog";
import { InvestmentDialog } from "../investments/InvestmentDialog";
import { LocationField } from "../money-locations/LocationField";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { HandCoins, CreditCard, Eye, EyeOff, Wallet, TrendingUp, Gem, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api, ApiError, errorMessage } from "@/lib/http";
import type { Family, Member } from "../families/api";
import { parseAmount } from "./model";

const sources = [{ value: "salary", label: "حقوق" }, { value: "subsidy", label: "یارانه" }, { value: "voucher", label: "کالابرگ" }, { value: "gift", label: "هدیه" }];
type Wallet = { familyId: string; members: Member[]; balance: string };
const funds = [{ value: "general", label: "روزمره" }, { value: "investments", label: "سرمایه" }, { value: "assets", label: "دارایی" }] as const;
type Fund = typeof funds[number]["value"];
type Kind = "income" | "expenses";
function report(error: unknown) {
  if (error instanceof ApiError && error.status === 401) window.location.replace("/login");
  return errorMessage(error);
}

export function FamilyWallet({ userId }: { userId: string }) {
  const [fund, setFund] = useState<Fund>("general");
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

  const canWrite = !!wallet?.members.some(m => m.user_id === userId);
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
    if (kind === "expenses" && !fields.get("category_id")) { setFormError("دسته‌بندی خرج رو انتخاب کنین؛ سازندهٔ خانواده می‌تونه از مدیریت اضافه‌اش کنه."); return; }
    const familyId = wallet.familyId;
    const payload = {
      amount_toman: amount,
      description: String(fields.get("description") ?? "").trim() || null,
      ...(kind === "income" ? { source: fields.get("source"), location_id: fields.get("location"), from_member_id: fields.get("member") } : { title: "خرج", category_id: fields.get("category_id"), paid_by_member_id: fields.get("member") }),
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

  function personalSaved(message: string) {
    setNotice(message);
    if (message) setRevision(n => n + 1);
  }
  const FundIcon = fund === "general" ? Wallet : fund === "investments" ? TrendingUp : Gem;
  const balanceLabel = wallet ? BigInt(wallet.balance).toLocaleString("fa-IR") : "";

  return <>
    <section className="wallet-balance" aria-label="صندوق‌ها">
      <div className="wallet-fund-switch" role="group" aria-label="انتخاب صندوق">{funds.map(item => <button key={item.value} type="button" aria-pressed={fund === item.value} onClick={() => setFund(item.value)}>{fund === item.value && <Check size={14} aria-hidden="true" />}{item.label}</button>)}</div>
      {fund === "general" && families.length > 1 && <label className="wallet-family">خانواده<Select id="wallet-family" value={wallet?.familyId ?? (families.some(f => f.id === selected) ? selected : families[0].id)} disabled={busy} onValueChange={value => { setSelected(value); setWallet(null); setLoading(true); setNotice(""); }} options={families.map(f => ({ value: f.id, label: f.name }))} /></label>}
      <div className="wallet-balance-row">
        <div className="wallet-balance-heading"><span className="wallet-balance-icon" aria-hidden="true"><FundIcon /></span><h1>موجودی</h1></div>
        <div className="wallet-balance-value">
      {fund === "general" ? <>
      {loading ? <p role="status">در حال دریافت موجودی…</p> : error ? <div role="alert"><p className="dash-error">{error}</p><Button variant="ghost" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div> : wallet ? <>
        <p className={`wallet-balance-amount${!hidden && balanceLabel.length > 13 ? " wallet-balance-amount-compact" : ""}`}><bdi>{hidden ? "••••••" : balanceLabel}</bdi> <small>تومان</small></p>
      </> : <p>برای ثبت دخل‌وخرج، اول از <a href="/families" className="underline">صفحهٔ خانواده</a> یه خانواده بسازین یا عضو خانواده بشین.</p>}
      </> : <PersonalFundValue key={fund} fund={fund} revision={revision} hidden={hidden} />}
        </div>
        <Button variant="ghost" size="icon" className="wallet-visibility" aria-label={hidden ? "نمایش مبلغ" : "پنهان کردن مبلغ"} aria-pressed={hidden} onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff /> : <Eye />}</Button>
      </div>
      <p className="wallet-balance-notice" role="status">{notice}</p>
    </section>
    <Dialog open={open} onOpenChange={value => { if (!pending.current) setOpen(value); }}>
      <div className="dash-home-actions">
        <DialogTrigger asChild><Button className="home-action home-action-income" size="lg" variant="outline" disabled={!canWrite || loading || busy} onClick={() => prepare("income")}><HandCoins aria-hidden="true" /><span>دخل</span></Button></DialogTrigger>
        <DialogTrigger asChild><Button className="home-action home-action-expense" size="lg" variant="outline" disabled={!canWrite || loading || busy} onClick={() => prepare("expenses")}><CreditCard aria-hidden="true" /><span>خرج</span></Button></DialogTrigger>
        <InvestmentDialog onSaved={personalSaved} />
        <AssetDialog onSaved={personalSaved} />
      </div>
      <DialogContent dir="rtl" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>{kind === "income" ? "ثبت دخل" : "ثبت خرج"}</DialogTitle><DialogDescription>برای خانوادهٔ {families.find(f => f.id === wallet?.familyId)?.name} ثبت می‌شه و اعضای خانواده می‌تونن ببیننش. همهٔ مبلغ‌ها به تومان هستن.</DialogDescription></DialogHeader>
        <form onSubmit={submit}><fieldset className="dash-form" disabled={busy}>
          <label htmlFor="wallet-amount">مبلغ (تومان)<MoneyInput id="wallet-amount" name="amount" inputMode="numeric" dir="ltr" required maxLength={24} /></label>
          {kind === "income" ? <label htmlFor="wallet-source">منبع درآمد<Select id="wallet-source" name="source" defaultValue="salary" options={sources} disabled={busy} required /></label> : <>
            {wallet && <CategoryField key={wallet.familyId} familyId={wallet.familyId} disabled={busy} />}
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
