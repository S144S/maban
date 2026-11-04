import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/http";
export type MoneyLocation = { id: string; name: string };
export function LocationField({ familyId, disabled }: { familyId: string; disabled: boolean }) {
  const [items, setItems] = useState<MoneyLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setItems([]); setError("");
    api<{ locations: MoneyLocation[] }>(`/families/${familyId}/money-locations`, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setItems(data.locations); }).catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [familyId, revision]);
  return <div className="dash-form">
    <label htmlFor="income-location">واریز به<Select key={familyId} id="income-location" name="location" required disabled={disabled || loading || !!error || !items.length} options={items.map(item => ({ value: item.id, label: item.name }))} /></label>
    {loading ? <p role="status">در حال دریافت حساب‌های خانواده…</p> : error ? <div role="alert"><p>{error}</p><Button type="button" variant="outline" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div> : !items.length && <p>برای این خانواده هنوز حسابی تعریف نشده. اول یک حساب مثل بانک ملی یا پول نقد در <a className="underline" href={`/dashboard?page=budgets&family=${encodeURIComponent(familyId)}`}>مدیریت</a> اضافه کنین.</p>}
  </div>;
}
