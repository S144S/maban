import { CategoryIcon } from "./categoryIcons";
import { useEffect, useState } from "react";
import "./category-field.css";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/http";
export type ExpenseCategory = { id: string; name: string; is_default: boolean; monthly_limit_toman: number | null; icon: string };

export function CategoryField({ familyId, disabled, optional = false }: { familyId: string; disabled: boolean; optional?: boolean }) {
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
  return <fieldset className="expense-category-field" disabled={disabled || loading}>
    <legend>{optional ? "دسته‌بندی (اختیاری)" : "دسته‌بندی"}</legend>
    {!loading && !error && <div className="expense-category-options">{optional && <label className="expense-category-choice"><input type="radio" name="category_id" value="" defaultChecked /><span className="expense-category-chip">بدون انتخاب (سایر)</span></label>}{items.filter(item => !optional || !item.is_default).map(item => <label key={item.id} className="expense-category-choice">
      <input type="radio" name="category_id" value={item.id} defaultChecked={!optional && item.is_default} required={!optional} />
      <span className="expense-category-chip"><CategoryIcon name={item.icon} /><span>{item.name}</span></span>
    </label>)}</div>}
    {loading ? <p role="status">در حال دریافت دسته‌بندی‌ها…</p> : error ? <div role="alert"><p className="dash-error">{error}</p><Button type="button" variant="outline" onClick={() => setRetry(n => n + 1)}>تلاش دوباره</Button></div> : !items.length && <p>هنوز دسته‌بندی خرجی ندارین. سازندهٔ خانواده می‌تونه از <a className="underline" href={`/dashboard?page=budgets&family=${encodeURIComponent(familyId)}`}>مدیریت</a> دسته‌بندی اضافه کنه.</p>}
  </fieldset>;
}
