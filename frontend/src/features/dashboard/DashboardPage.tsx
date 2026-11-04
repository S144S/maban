import { FamilyWallet } from "./FamilyWallet";
import { Select } from "@/components/ui/select";
import { useRef, useState, type FormEvent } from "react";
import { House, Wallet, Plus, ShoppingBasket, Coffee, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ReferenceArtwork } from "../landing/ReferenceArtwork";
import { TransactionForm } from "./TransactionForm";
import { categories, initialTransactions, formatMoney, parseAmount } from "./model";
import "./dashboard.css";
import { AccountMenu } from "../auth/AccountMenu";
import type { User } from "../auth/api";

const icons = { home: House, groceries: ShoppingBasket, leisure: Coffee };
type Page = "home" | "transactions" | "budgets";
export function DashboardPage({ user, page }: { user: User; page: Page; onNavigate: (page: Page) => void }) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [limits, setLimits] = useState(categories.map(c => c.limit));
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const hidden = false;
  const [open, setOpen] = useState(false);
  const [entryKind, setEntryKind] = useState<"income" | "expense">("expense");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetError, setBudgetError] = useState("");
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const money = (value: number) => hidden ? "••••••" : formatMoney(value);
  function saveBudgets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = categories.map(c => parseAmount(String(data.get(c.id) ?? "")));
    const invalid = values.findIndex(v => v === null);
    if (invalid !== -1) { setBudgetError("برای هر دسته مبلغ صحیح و مثبت تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ تومان وارد کنین."); (form.elements.namedItem(categories[invalid].id) as HTMLInputElement)?.focus(); return; }
    setLimits(values as number[]); setBudgetOpen(false); setNotice("بودجه‌های نمونه به‌روز شدن.");
  }
  const rows = transactions.filter(t => (filter === "all" || t.kind === filter) && t.title.includes(search.trim()));
  const budgetSection = <section className="dash-section" aria-labelledby="budget-heading">
    <div className="dash-section-heading"><h2 id="budget-heading">بودجهٔ ماه</h2><Dialog open={budgetOpen} onOpenChange={value => { setBudgetOpen(value); setBudgetError(""); }}><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="ویرایش بودجه"><SlidersHorizontal /></Button></DialogTrigger><DialogContent dir="rtl"><DialogHeader><DialogTitle>بودجه‌های این ماه</DialogTitle><DialogDescription>برای هر دسته، بودجهٔ نمونه رو به تومان وارد کنین.</DialogDescription></DialogHeader><form className="dash-form" onSubmit={saveBudgets} noValidate>{categories.map((c, i) => <label key={c.id} htmlFor={`budget-${c.id}`}>{c.title}<input id={`budget-${c.id}`} name={c.id} inputMode="numeric" dir="ltr" defaultValue={limits[i]} aria-describedby={budgetError ? "budget-error" : undefined} /></label>)}{budgetError && <p id="budget-error" className="dash-error" role="alert">{budgetError}</p>}<Button type="submit">ذخیرهٔ بودجه</Button></form></DialogContent></Dialog></div>
    <p className="dash-muted dash-small">هزینه‌شده از بودجه · تومان</p>
    {categories.map((c, i) => {
      const spent = transactions.filter(t => t.kind === "expense" && t.category === c.id).reduce((sum, t) => sum + t.amount, 0);
      const Icon = icons[c.id];
      return <div className={`dash-budget dash-category-${c.id}`} key={c.id}><div className="dash-row"><span className="dash-category-label"><Icon size={18} aria-hidden="true" />{c.title}</span><strong>{hidden ? "•••" : `${formatMoney(Math.round(spent / limits[i] * 100))}٪`}</strong></div><progress value={Math.min(spent, limits[i])} max={limits[i]} aria-label={`بودجهٔ ${c.title}`} aria-valuetext={hidden ? "مبلغ پنهان است" : `${formatMoney(spent)} از ${formatMoney(limits[i])} تومان`} /><div className="dash-row dash-small dash-muted"><span>{money(spent)} از {money(limits[i])}</span>{spent > limits[i] && !hidden && <span className="dash-error">بیشتر از بودجه</span>}</div></div>;
    })}
  </section>;
  return <div className="dash-shell">
    <a className="skip-link" href="#dashboard-main">رفتن به محتوای اصلی</a>
    <header className="dash-header"><a href="/" aria-label="مابان، صفحهٔ اصلی"><ReferenceArtwork variant="brand" /></a><AccountMenu /></header>
    <main id="dashboard-main" className="dash-main">
      {page !== "home" && <><div className="dash-welcome"><h1 ref={heading} tabIndex={-1}>{page === "transactions" ? "تراکنش‌های شما" : "بودجه‌های شما"}</h1></div><p className="dash-demo">پیش‌نمایش با داده‌های نمونه؛ تغییرات با بستن یا بارگذاری مجدد صفحه پاک می‌شن.</p></>}
      {page === "home" ? <FamilyWallet userId={user.id} /> : <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="lg" className="dash-add" onClick={() => setEntryKind("expense")}><Plus />ثبت تراکنش نمونه</Button></DialogTrigger><DialogContent dir="rtl"><DialogHeader><DialogTitle>ثبت تراکنش نمونه</DialogTitle><DialogDescription>این فرم فقط برای پیش‌نمایشه و روی موجودی واقعی خانواده تأثیر نداره. برای ثبت واقعی از دخل و خرج صفحهٔ خانه استفاده کنین.</DialogDescription></DialogHeader><TransactionForm initialKind={entryKind} onSave={transaction => { setTransactions(current => [transaction, ...current]); setOpen(false); setNotice("تراکنش نمونه ثبت شد."); }} /></DialogContent></Dialog>}
      <p className={page === "home" ? "sr-only" : "dash-status"} role="status">{notice}</p>
      {page === "budgets" && budgetSection}
      {page === "transactions" && <section className="dash-section" aria-labelledby="transactions-heading"><div className="dash-section-heading"><h2 id="transactions-heading">فهرست تراکنش‌ها</h2></div>
        {page === "transactions" && <div className="dash-form dash-filters"><label htmlFor="transaction-search">جست‌وجوی عنوان<input id="transaction-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="مثلاً خرید خانه" /></label><label htmlFor="transaction-filter">نوع تراکنش<Select id="transaction-filter" value={filter} onValueChange={setFilter} options={[{ value: "all", label: "همهٔ تراکنش‌ها" }, { value: "expense", label: "هزینه‌ها" }, { value: "income", label: "درآمدها" }]} /></label></div>}
        <ul className="dash-transactions">{rows.map(t => { const Icon = t.kind === "income" ? Wallet : icons[t.category]; return <li key={t.id}><span className={`dash-transaction-icon ${t.kind === "income" ? "dash-income" : ""}`}><Icon size={20} aria-hidden="true" /></span><div className="dash-transaction-copy"><strong>{t.title}</strong><span>{t.date} · {t.kind === "income" ? "درآمد" : "هزینه"}</span></div><div className="dash-transaction-money"><bdi>{money(t.amount)}</bdi><small>تومان</small></div></li>; })}</ul>{page === "transactions" && rows.length === 0 && <p className="dash-empty">تراکنشی پیدا نشد؛ جست‌وجو یا فیلتر رو تغییر بدین.</p>}
      </section>}
      {page !== "home" && <p className="dash-end">قدم‌های کوچیک، حساب‌وکتاب روشن‌تر.</p>}
    </main>
  </div>;
}
