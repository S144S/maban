import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecentTransaction } from "./recent-transactions";

const date = new Intl.DateTimeFormat("fa-IR", {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran",
});

export function RecentTransactions({ items, loading, error, hasFamily, hidden, onRetry }: {
  items: RecentTransaction[]; loading: boolean; error: string; hasFamily: boolean;
  hidden: boolean; onRetry: () => void;
}) {
  return <details className="wallet-recent">
    <summary><span>۳ تراکنش آخر</span><ChevronDown size={20} aria-hidden="true" /></summary>
    <div className="wallet-recent-body">
      {loading ? <p role="status">در حال دریافت تراکنش‌ها…</p>
        : error ? <div role="alert"><p className="dash-error">{error}</p><Button variant="outline" onClick={onRetry}>تلاش دوباره</Button></div>
        : !hasFamily ? <p className="dash-muted">برای دیدن تراکنش‌ها، اول خانواده‌تون رو انتخاب کنین.</p>
        : !items.length ? <p className="dash-muted">هنوز دخل یا خرجی ثبت نکردین.</p>
        : <ul>{items.map(item => <li key={`${item.kind}:${item.id}`}>
          <div className="wallet-recent-copy"><div className="wallet-recent-heading"><span className="wallet-transaction-kind" data-kind={item.kind}>{item.kind === "income" ? "دخل" : "خرج"}</span><strong>{item.label}</strong></div><time dateTime={item.created_at}>{date.format(new Date(item.created_at))}</time></div>
          <span className="wallet-recent-amount"><bdi>{hidden ? "••••••" : BigInt(item.amount_toman).toLocaleString("fa-IR")}</bdi><small>تومان</small></span>
        </li>)}</ul>}
    </div>
  </details>;
}
