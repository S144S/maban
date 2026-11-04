import { CategoryIcon } from "./categoryIcons";
import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/http";
export type ExpenseCategory = { id: string; name: string; is_default: boolean; icon: string };

export function CategoryField({ familyId, disabled }: { familyId: string; disabled: boolean }) {
  const [items, setItems] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setItems([]); setError("");
    api<{ categories: ExpenseCategory[] }>(`/families/${familyId}/expenses/categories`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems(data.categories); })
      .catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [familyId, retry]);
  return <div className="dash-form">
    <label htmlFor="expense-category">دسته‌بندی خرج<Select key={familyId} id="expense-category" name="category_id" required disabled={disabled || loading || !!error || !items.length} options={items.map(item => ({ value: item.id, label: item.name, icon: <CategoryIcon name={item.icon} /> }))} /></label>
    {loading ? <p role="status">در حال دریافت دسته‌بندی‌ها…</p> : error ? <div role="alert"><p className="dash-error">{error}</p><Button type="button" variant="outline" onClick={() => setRetry(n => n + 1)}>تلاش دوباره</Button></div> : !items.length && <p>هنوز دسته‌بندی خرجی ندارین. سازندهٔ خانواده می‌تونه از <a className="underline" href={`/dashboard?page=budgets&family=${encodeURIComponent(familyId)}`}>مدیریت</a> دسته‌بندی اضافه کنه.</p>}
  </div>;
}
