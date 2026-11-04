import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError, errorMessage } from "@/lib/http";

type Summary = { total_toman: string; count: number; unpriced_count: number };

// Format decimal strings without converting large totals to floating-point numbers.
function formatValue(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const tail = fraction.replace(/0+$/, "").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  return BigInt(whole).toLocaleString("fa-IR") + (tail ? "٫" + tail : "");
}

export function PersonalFundValue({ fund, revision, hidden }: { fund: "investments" | "assets"; revision: number; hidden: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setSummary(null); setError("");
    void api<Summary>(`/${fund}/summary`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setSummary(result);
    }).catch(err => {
      if (controller.signal.aborted) return;
      if (err instanceof ApiError && err.status === 401) window.location.replace("/login");
      setError(errorMessage(err));
    });
    return () => controller.abort();
  }, [fund, revision, retry]);
  if (error) return <div role="alert"><p className="dash-error">{error}</p><Button variant="ghost" onClick={() => setRetry(n => n + 1)}>تلاش دوباره</Button></div>;
  if (!summary) return <p role="status">در حال دریافت ارزش صندوق…</p>;
  const allUnpriced = summary.count > 0 && summary.count === summary.unpriced_count;
  const label = allUnpriced ? "نامشخص" : formatValue(summary.total_toman);
  return <div aria-live="polite">
    <p className={`wallet-balance-amount${!hidden && label.length > 13 ? " wallet-balance-amount-compact" : ""}`}><bdi>{hidden ? "••••••" : label}</bdi>{!allUnpriced && <small>تومان</small>}</p>
    <p className="wallet-fund-note">{summary.count === 0 ? "هنوز موردی در این صندوق ثبت نکردین." : "بر اساس قیمت‌های ثبت‌شده؛ قیمت روز نیست."}</p>
    {summary.unpriced_count > 0 && <p className="wallet-fund-note">{summary.unpriced_count.toLocaleString("fa-IR")} مورد بدون قیمت{allUnpriced ? "؛ برای محاسبهٔ ارزش، قیمت لازمه." : " در این مبلغ حساب نشده."}</p>}
  </div>;
}
