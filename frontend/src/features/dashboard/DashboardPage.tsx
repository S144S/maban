import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpLeft, ArrowRight, House, ListFilter, Wallet, Plus, ShoppingBasket, Coffee, SlidersHorizontal, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ReferenceArtwork } from "../landing/ReferenceArtwork";
import { TransactionForm } from "./TransactionForm";
import { categories, initialTransactions, formatMoney, parseAmount, summarize } from "./model";
import "./dashboard.css";

const icons = { home: House, groceries: ShoppingBasket, leisure: Coffee };
const pages = [{ id: "home", label: "خانه", icon: House }, { id: "transactions", label: "تراکنش‌ها", icon: ListFilter }, { id: "budgets", label: "بودجه", icon: Wallet }] as const;
type Page = typeof pages[number]["id"];

export function DashboardPage() {
  const [page, setPage] = useState<Page>("home");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [limits, setLimits] = useState(categories.map(c => c.limit));
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetError, setBudgetError] = useState("");
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const totals = summarize(transactions);
  const money = (value: number) => hidden ? "••••••" : formatMoney(value);
  useEffect(() => { document.title = "داشبورد | مابان"; }, []);
  function navigate(next: Page) { setPage(next); window.scrollTo({ top: 0, behavior: "instant" }); requestAnimationFrame(() => heading.current?.focus()); }
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
    <header className="dash-header"><a href="/" aria-label="مابان، صفحهٔ اصلی"><ReferenceArtwork variant="brand" /></a><a className="dash-back" href="/"><ArrowRight size={16} aria-hidden="true" />صفحهٔ اصلی</a></header>
    <main id="dashboard-main" className="dash-main">
      <div className="dash-welcome"><div><h1 ref={heading} tabIndex={-1}>{page === "home" ? "حساب‌وکتاب خونه" : page === "transactions" ? "تراکنش‌های شما" : "بودجه‌های شما"}</h1><p className="dash-muted">{page === "home" ? "سلام، خوش اومدین!" : "یه تصویر روشن از پول‌هاتون"} <span aria-hidden="true">🌱</span></p></div><span className="dash-month">مهر ۱۴۰۵</span></div>
      <p className="dash-demo">پیش‌نمایش با داده‌های نمونه؛ تغییرات با بستن یا بارگذاری مجدد صفحه پاک می‌شن.</p>
      {page === "home" && <section className="dash-balance" aria-label="خلاصهٔ مالی مهر"><div className="dash-row"><span>باقی‌ماندهٔ این ماه</span><Button variant="ghost" size="icon" aria-label={hidden ? "نمایش مبلغ‌ها" : "پنهان کردن مبلغ‌ها"} aria-pressed={hidden} onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff /> : <Eye />}</Button></div><p className="dash-total"><bdi>{money(totals.balance)}</bdi> <small>تومان</small></p><div className="dash-cashflow"><div><span><ArrowDownLeft size={18} aria-hidden="true" />درآمد ماه</span><strong>{money(totals.income)}</strong><small>تومان</small></div><div><span><ArrowUpLeft size={18} aria-hidden="true" />هزینهٔ ماه</span><strong>{money(totals.expense)}</strong><small>تومان</small></div></div></section>}
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="lg" className="dash-add"><Plus />ثبت تراکنش</Button></DialogTrigger><DialogContent dir="rtl"><DialogHeader><DialogTitle>ثبت تراکنش جدید</DialogTitle><DialogDescription>یه درآمد یا هزینهٔ نمونه ثبت کنین و تغییر موجودی رو ببینین. اطلاعات ذخیره نمی‌شن.</DialogDescription></DialogHeader><TransactionForm onSave={transaction => { setTransactions(current => [transaction, ...current]); setOpen(false); setNotice("تراکنش نمونه ثبت شد؛ موجودی و بودجه به‌روز شدن."); }} /></DialogContent></Dialog>
      <p className="dash-status" role="status">{notice}</p>
      {page !== "transactions" && budgetSection}
      {page !== "budgets" && <section className="dash-section" aria-labelledby="transactions-heading"><div className="dash-section-heading"><h2 id="transactions-heading">{page === "home" ? "آخرین تراکنش‌ها" : "فهرست تراکنش‌ها"}</h2>{page === "home" && <Button variant="ghost" onClick={() => navigate("transactions")}>همه</Button>}</div>
        {page === "transactions" && <div className="dash-form dash-filters"><label htmlFor="transaction-search">جست‌وجوی عنوان<input id="transaction-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="مثلاً خرید خانه" /></label><label htmlFor="transaction-filter">نوع تراکنش<select id="transaction-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">همهٔ تراکنش‌ها</option><option value="expense">هزینه‌ها</option><option value="income">درآمدها</option></select></label></div>}
        <ul className="dash-transactions">{(page === "home" ? transactions.slice(0, 3) : rows).map(t => { const Icon = t.kind === "income" ? Wallet : icons[t.category]; return <li key={t.id}><span className={`dash-transaction-icon ${t.kind === "income" ? "dash-income" : ""}`}><Icon size={20} aria-hidden="true" /></span><div className="dash-transaction-copy"><strong>{t.title}</strong><span>{t.date} · {t.kind === "income" ? "درآمد" : "هزینه"}</span></div><div className="dash-transaction-money"><bdi>{money(t.amount)}</bdi><small>تومان</small></div></li>; })}</ul>{page === "transactions" && rows.length === 0 && <p className="dash-empty">تراکنشی پیدا نشد؛ جست‌وجو یا فیلتر رو تغییر بدین.</p>}
      </section>}
      <p className="dash-end">قدم‌های کوچیک، حساب‌وکتاب روشن‌تر.</p>
    </main>
    <nav className="dash-nav" aria-label="ناوبری داشبورد">{pages.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-current={page === id ? "page" : undefined} onClick={() => navigate(id)}><span><Icon size={22} aria-hidden="true" /></span>{label}</button>)}</nav>
  </div>;
}
