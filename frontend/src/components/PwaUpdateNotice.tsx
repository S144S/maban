import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activatePwaUpdate, watchPwaUpdates } from "@/lib/pwa-updates";

export function PwaUpdateNotice() {
  const [worker, setWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState<ServiceWorker | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    return watchPwaUpdates(setWorker);
  }, []);

  async function update() {
    if (!worker || busy) return;
    setBusy(true);
    setError("");
    try {
      await activatePwaUpdate(worker);
      window.location.reload();
    } catch {
      setError("به‌روزرسانی انجام نشد. اتصال اینترنت رو بررسی و دوباره امتحان کنین.");
      setBusy(false);
    }
  }

  if (!worker || worker === dismissed) return null;
  return (
    <aside className="pwa-update-notice" aria-label="به‌روزرسانی مابان" aria-busy={busy}>
      <div className="pwa-update-body">
        <span className="pwa-update-icon" aria-hidden="true">
          {confirming ? <Save size={22} /> : <RefreshCw size={22} />}
        </span>
        <div className="pwa-update-copy" role="status" aria-atomic="true">
          <h2>{busy ? "در حال به‌روزرسانی…" : confirming ? "فرم‌هاتون رو ذخیره کردین؟" : "نسخهٔ جدید مابان آماده‌ست"}</h2>
          <p>{busy
            ? "لطفاً چند لحظه صبر کنین؛ صفحه دوباره باز می‌شه."
            : confirming
              ? "با بازخوانی صفحه، تغییرات ذخیره‌نشده از دست می‌رن. قبل از ادامه، فرم‌هاتون رو ذخیره کنین."
              : "با به‌روزرسانی، صفحه یک بار دوباره باز می‌شه."}</p>
        </div>
      </div>
      {error && <div role="alert" className="pwa-update-error"><AlertCircle size={18} aria-hidden="true" /><p>{error}</p></div>}
      <div className="pwa-update-actions">
        <Button disabled={busy} onClick={() => confirming ? void update() : setConfirming(true)}>
          {busy ? "لطفاً صبر کنین…" : error ? "تلاش دوباره" : confirming ? "به‌روزرسانی کن" : "به‌روزرسانی"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => {
          if (!confirming) setDismissed(worker);
          setConfirming(false);
          setError("");
        }}>{confirming ? "برگشت" : "بعداً"}</Button>
      </div>
    </aside>
  );
}
