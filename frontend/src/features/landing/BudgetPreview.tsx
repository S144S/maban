import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpLeft,
  ChevronDown,
  Coffee,
  House,
  ShoppingBasket,
  Wallet,
  Sprout,
  RotateCcw,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import "./budget-preview.css";

const number = new Intl.NumberFormat("fa-IR");
const categories = [
  {
    title: "خانه و زندگی",
    amount: 9000000,
    limit: 12000000,
    icon: House,
    color: "chart-2",
  },
  {
    title: "خرید روزمره",
    amount: 4500000,
    limit: 7000000,
    icon: ShoppingBasket,
    color: "chart-1",
  },
  {
    title: "تفریح و خوش‌گذرانی",
    amount: 3000000,
    limit: 6000000,
    icon: Coffee,
    color: "chart-3",
  },
];

export function BudgetPreview() {
  const [expenses, setExpenses] = useState(0);
  return (
    <div className="preview-scene" id="demo" tabIndex={-1}>
      <div className="orbit" aria-hidden="true" />
      <section className="budget-preview" aria-labelledby="preview-title">
        <header className="preview-header">
          <div className="flex items-center gap-3">
            <span className="icon-tile">
              <Wallet size={21} />
            </span>
            <div>
              <h2 id="preview-title">حساب خانهٔ ما</h2>
              <span className="small-copy">پیش‌نمایش با داده‌های نمونه</span>
            </div>
          </div>
          <span className="month">
            مهر ۱۴۰۵ <ChevronDown size={14} />
          </span>
        </header>
        <div className="balance">
          <span>باقی‌ماندهٔ این ماه</span>
          <div aria-live="polite">
            <strong>{number.format(18500000 - expenses * 150000)}</strong>
            <span>تومان</span>
          </div>
          <span className="balance-note">هر قدم کوچک، خیال راحت‌تر</span>
        </div>
        <div className="cashflow">
          <div>
            <ArrowDownLeft size={18} />
            <span>
              درآمد ماه
              <strong>
                ۳۵٬۰۰۰٬۰۰۰ <small>تومان</small>
              </strong>
            </span>
          </div>
          <div>
            <ArrowUpLeft size={18} />
            <span>
              هزینهٔ ماه
              <strong>
                {number.format(16500000 + expenses * 150000)}{" "}
                <small>تومان</small>
              </strong>
            </span>
          </div>
        </div>
        <div className="budget-title">
          <h3>بودجه‌های این ماه</h3>
          <span>هزینه / بودجه</span>
        </div>
        <div className="budget-categories">
          {categories.map(({ title, amount, limit, icon: Icon, color }, i) => {
            const total = amount + (i === 1 ? expenses * 150000 : 0);
            return (
              <div key={title} className="budget-row">
                <div className="flex items-center gap-2">
                  <Icon size={17} />
                  <span>{title}</span>
                  <span className="budget-amount">
                    {number.format(total / 1000000)} /{" "}
                    {number.format(limit / 1000000)} میلیون
                  </span>
                </div>
                <progress
                  className={color}
                  value={total}
                  max={limit}
                  aria-label={`بودجهٔ ${title}`}
                />
              </div>
            );
          })}
        </div>
        <div className="demo-actions">
          <Button
            variant="outline"
            onClick={() => setExpenses((x) => x + 1)}
            disabled={expenses >= 16}
          >
            <Plus data-icon="inline-start" />
            ثبت خرید نمونه · ۱۵۰ هزار تومان
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="بازنشانی نمونه"
            onClick={() => setExpenses(0)}
          >
            <RotateCcw />
          </Button>
        </div>
        <p className="demo-message" role="status">
          {expenses
            ? `${number.format(expenses)} خرید نمونه ثبت شد؛ بودجه و موجودی به‌روز شدند.`
            : "یک خرید ثبت کنید و تغییر بودجه را ببینید."}
        </p>
      </section>
      <div className="goal-card">
        <span className="goal-icon">
          <Sprout size={25} />
        </span>
        <div>
          <span className="small-copy">برای روزهای قشنگ‌تر</span>
          <h3>پس‌انداز سفر خانوادگی</h3>
          <div className="goal-track">
            <span />
          </div>
          <p>
            ۱۲ میلیون از ۲۰ میلیون تومان <strong>۶۰٪</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
