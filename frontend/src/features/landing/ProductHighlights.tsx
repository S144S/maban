import { CarFront, House, ShoppingBag, TreePalm, Utensils } from "lucide-react";
const spending = [
  { icon: Utensils, label: "خوراک", value: "۳۸٪", color: "food" },
  { icon: House, label: "مسکن", value: "۲۴٪", color: "home" },
  { icon: CarFront, label: "حمل‌ونقل", value: "۱۲٪", color: "transport" },
  { icon: ShoppingBag, label: "سایر", value: "۲۶٪", color: "other" },
];
export function ProductHighlights() {
  return (
    <div className="product-highlights" aria-label="نمونهٔ گزارش و هدف مالی">
      <article className="mini-card goal-mini">
        <h3>هدف مالی</h3>
        <div className="goal-mini-content">
          <div>
            <span className="category-icon transport">
              <TreePalm />
            </span>
            <strong>سفر تابستانی</strong>
          </div>
          <div className="goal-progress">
            <progress
              value={70}
              max={100}
              aria-label="هدف سفر تابستانی؛ ۷۰ درصد"
            />
            <strong>۷۰٪</strong>
          </div>
          <p>۷۰٬۰۰۰٬۰۰۰ از ۱۰۰٬۰۰۰٬۰۰۰ تومان</p>
        </div>
      </article>
      <article className="mini-card expense-mini">
        <h3>هزینه‌ها در این ماه</h3>
        {spending.map(({ icon: Icon, label, value, color }) => (
          <div className="expense-line" key={label}>
            <span className={`category-icon ${color}`}>
              <Icon />
            </span>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </article>
      <article className="mini-card report-mini">
        <h3>گزارش ماهانه</h3>
        <div
          className="mini-bars"
          role="img"
          aria-label="هزینه‌های نمونه در شش ماه، از ۳ تا ۶ میلیون تومان"
        >
          {[3, 5, 3, 4, 5, 6].map((value, i) => (
            <span key={i} style={{ height: `${value * 13}px` }} />
          ))}
        </div>
        <p>هزینه‌ها</p>
      </article>
    </div>
  );
}
