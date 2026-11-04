import { Management } from "../money-locations/Management";
import { FamilyWallet } from "./FamilyWallet";
import { Select } from "@/components/ui/select";
import { useRef, useState } from "react";
import { House, Wallet, Plus, ShoppingBasket, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ReferenceArtwork } from "../landing/ReferenceArtwork";
import { TransactionForm } from "./TransactionForm";
import { initialTransactions, formatMoney } from "./model";
import "./dashboard.css";
import { AccountMenu } from "../auth/AccountMenu";
import type { User } from "../auth/api";

const icons = { home: House, groceries: ShoppingBasket, leisure: Coffee };
type Page = "home" | "transactions" | "budgets";
export function DashboardPage({ user, page }: { user: User; page: Page; onNavigate: (page: Page) => void }) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const hidden = false;
  const [open, setOpen] = useState(false);
  const [entryKind, setEntryKind] = useState<"income" | "expense">("expense");
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const money = (value: number) => hidden ? "••••••" : formatMoney(value);
  const rows = transactions.filter(t => (filter === "all" || t.kind === filter) && t.title.includes(search.trim()));
  return <div className="dash-shell">
    <a className="skip-link" href="#dashboard-main">رفتن به محتوای اصلی</a>
    <header className="dash-header"><a href="/" aria-label="مابان، صفحهٔ اصلی"><ReferenceArtwork variant="brand" /></a><AccountMenu /></header>
    <main id="dashboard-main" className="dash-main">
      {page !== "home" && <><div className="dash-welcome"><h1 ref={heading} tabIndex={-1}>{page === "transactions" ? "تراکنش‌های شما" : "مدیریت"}</h1></div>{page === "transactions" && <p className="dash-demo">پیش‌نمایش با داده‌های نمونه؛ تغییرات با بستن یا بارگذاری مجدد صفحه پاک می‌شن.</p>}</>}
      {page === "home" ? <FamilyWallet userId={user.id} /> : page === "transactions" ? <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="lg" className="dash-add" onClick={() => setEntryKind("expense")}><Plus />ثبت تراکنش نمونه</Button></DialogTrigger><DialogContent dir="rtl"><DialogHeader><DialogTitle>ثبت تراکنش نمونه</DialogTitle><DialogDescription>این فرم فقط برای پیش‌نمایشه و روی موجودی واقعی خانواده تأثیر نداره. برای ثبت واقعی از دخل و خرج صفحهٔ خانه استفاده کنین.</DialogDescription></DialogHeader><TransactionForm initialKind={entryKind} onSave={transaction => { setTransactions(current => [transaction, ...current]); setOpen(false); setNotice("تراکنش نمونه ثبت شد."); }} /></DialogContent></Dialog> : null}
      <p className={page === "home" ? "sr-only" : "dash-status"} role="status">{notice}</p>
      {page === "budgets" && <Management userId={user.id} />}
      {page === "transactions" && <section className="dash-section" aria-labelledby="transactions-heading"><div className="dash-section-heading"><h2 id="transactions-heading">فهرست تراکنش‌ها</h2></div>
        {page === "transactions" && <div className="dash-form dash-filters"><label htmlFor="transaction-search">جست‌وجوی عنوان<input id="transaction-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="مثلاً خرید خانه" /></label><label htmlFor="transaction-filter">نوع تراکنش<Select id="transaction-filter" value={filter} onValueChange={setFilter} options={[{ value: "all", label: "همهٔ تراکنش‌ها" }, { value: "expense", label: "هزینه‌ها" }, { value: "income", label: "درآمدها" }]} /></label></div>}
        <ul className="dash-transactions">{rows.map(t => { const Icon = t.kind === "income" ? Wallet : icons[t.category]; return <li key={t.id}><span className={`dash-transaction-icon ${t.kind === "income" ? "dash-income" : ""}`}><Icon size={20} aria-hidden="true" /></span><div className="dash-transaction-copy"><strong>{t.title}</strong><span>{t.date} · {t.kind === "income" ? "درآمد" : "هزینه"}</span></div><div className="dash-transaction-money"><bdi>{money(t.amount)}</bdi><small>تومان</small></div></li>; })}</ul>{page === "transactions" && rows.length === 0 && <p className="dash-empty">تراکنشی پیدا نشد؛ جست‌وجو یا فیلتر رو تغییر بدین.</p>}
      </section>}
      {page === "transactions" && <p className="dash-end">قدم‌های کوچیک، حساب‌وکتاب روشن‌تر.</p>}
    </main>
  </div>;
}
