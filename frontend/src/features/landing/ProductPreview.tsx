import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpLeft,
  Check,
  Plus,
  RotateCcw,
  ShoppingBasket,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const number = new Intl.NumberFormat("fa-IR");
const views = ["حساب خانواده", "خریدهای خونه", "گزارش خرج‌ها"] as const;
const groceries = ["شیر · ۲ عدد", "نان · ۳ عدد", "میوه · ۲ کیلو"];

/** Deliberately local sample data; never reads or writes a user's account. */
export function ProductPreview() {
  const [view, setView] = useState<(typeof views)[number]>(views[0]);
  const [added, setAdded] = useState(false);
  const [checked, setChecked] = useState<string[]>([groceries[0]]);
  const extra = added ? 150000 : 0;
  function reset() {
    setAdded(false);
    setChecked([groceries[0]]);
  }
  return (
    <section
      className="landing-demo"
      id="demo"
      aria-labelledby="demo-title"
      tabIndex={-1}
    >
      <div className="landing-demo-label">
        <span>
          <span className="landing-demo-dot" />
          نمایش نمونه
        </span>
        <span>بدون نیاز به ثبت‌نام</span>
      </div>
      <div className="landing-demo-window">
        <header className="landing-demo-header">
          <span className="landing-demo-avatar">
            <Users aria-hidden="true" size={21} />
          </span>
          <div>
            <h2 id="demo-title">خانوادهٔ ما</h2>
            <span>حساب‌وکتاب مشترک</span>
          </div>
          <span className="landing-demo-month">آبان ۱۴۰۵</span>
        </header>
        <div
          className="landing-demo-switch"
          role="group"
          aria-label="بخش‌های نمایش نمونه"
        >
          {views.map((name) => (
            <button
              key={name}
              aria-pressed={view === name}
              onClick={() => setView(name)}
            >
              {view === name && <Check size={14} aria-hidden="true" />}
              {name}
            </button>
          ))}
        </div>
        <div className="landing-demo-body">
          {view === views[0] && (
            <>
              <div className="landing-demo-balance">
                <span>ماندهٔ حساب نمونه</span>
                <p>
                  <strong>{number.format(18500000 - extra)}</strong>
                  <span>تومان</span>
                </p>
              </div>
              <div className="landing-demo-cashflow">
                <div>
                  <ArrowDownLeft aria-hidden="true" />
                  <span>
                    درآمد
                    <strong>
                      ۳۵٬۰۰۰٬۰۰۰ <small>تومان</small>
                    </strong>
                  </span>
                </div>
                <div>
                  <ArrowUpLeft aria-hidden="true" />
                  <span>
                    خرج
                    <strong>
                      {number.format(16500000 + extra)} <small>تومان</small>
                    </strong>
                  </span>
                </div>
              </div>
              <div className="landing-demo-recent">
                <h3>آخرین ثبت‌ها</h3>
                <div>
                  <span className="landing-demo-item-icon">
                    <ShoppingBasket size={18} aria-hidden="true" />
                  </span>
                  <span>
                    {added ? "خرید میوه" : "خرید خونه"}
                    <small>
                      {added ? "امروز · خرید روزمره" : "۲۲ آبان · خرید روزمره"}
                    </small>
                  </span>
                  <strong>
                    {added ? "۱۵۰٬۰۰۰" : "۸۵۰٬۰۰۰"}
                    <small>تومان</small>
                  </strong>
                </div>
              </div>
              <Button
                className="landing-demo-add"
                onClick={() => setAdded(true)}
                disabled={added}
              >
                <Plus aria-hidden="true" />
                {added ? "خرج نمونه ثبت شد" : "ثبت خرج نمونه · ۱۵۰ هزار تومان"}
              </Button>
            </>
          )}
          {view === views[1] && (
            <div className="landing-demo-shopping">
              <h3>خرید این هفته</h3>
              <p>{number.format(checked.length)} از ۳ مورد خریداری شده</p>
              <div>
                {groceries.map((item) => (
                  <label key={item}>
                    <input
                      type="checkbox"
                      checked={checked.includes(item)}
                      onChange={(event) =>
                        setChecked((items) =>
                          event.target.checked
                            ? [...items, item]
                            : items.filter((value) => value !== item),
                        )
                      }
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
              <p>
                موارد خریداری‌شده رو تیک بزنین. در مابان می‌تونین بعد از خرید،
                هزینهٔ کل لیست رو هم ثبت کنین.
              </p>
            </div>
          )}
          {view === views[2] && (
            <div className="landing-demo-report">
              <h3>خرج‌ها کجا رفتن؟</h3>
              <p>نمونهٔ دسته‌بندی هزینه‌های آبان</p>
              {[
                ["خانه و زندگی", 9000000, "report-home"],
                ["خرید روزمره", 4500000 + extra, "report-shopping"],
                ["تفریح", 3000000, "report-leisure"],
              ].map(([label, amount, color]) => (
                <div className="landing-demo-report-row" key={label}>
                  <div>
                    <span>{label}</span>
                    <strong>
                      {number.format(Number(amount))} <small>تومان</small>
                    </strong>
                  </div>
                  <progress
                    className={String(color)}
                    value={Number(amount)}
                    max={16500000 + extra}
                    aria-label={String(label)}
                  />
                </div>
              ))}
              <p className="landing-demo-report-total">
                جمع خرج‌ها{" "}
                <strong>{number.format(16500000 + extra)} تومان</strong>
              </p>
            </div>
          )}
        </div>
        <footer className="landing-demo-footer">
          <p role="status">
            {added
              ? "خرج نمونه به حساب و گزارش اضافه شد."
              : "این اعداد نمونه‌ان؛ تغییری در حساب شما ایجاد نمی‌شه."}
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={reset}
            aria-label="بازنشانی نمایش نمونه"
          >
            <RotateCcw />
          </Button>
        </footer>
      </div>
      <p className="landing-demo-caption">
        یه خرج ثبت کنین، بعد گزارشش رو ببینین.
      </p>
    </section>
  );
}
