import { useEffect, useState } from "react";
import { Bell, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/http";
import { formatReminderDate } from "./date";
import type { Reminder } from "./model";
import { reminderUrgency } from "./urgency";
import "./reminders.css";

type Upcoming = Reminder & { occurrence_at: string };
export function UpcomingReminders({ onManage }: { onManage: () => void }) {
  const [items, setItems] = useState<Upcoming[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api<{ reminders: Upcoming[]; has_more: boolean }>(`/reminders/upcoming?offset=${offset}`, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        if (offset && !result.reminders.length) { setOffset(0); return; }
        setItems(result.reminders); setHasMore(result.has_more);
      }).catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [offset, revision]);
  return <section className="upcoming-reminders" aria-labelledby="upcoming-title">
    <div className="upcoming-heading"><h2 id="upcoming-title">یادت نره!</h2><Button variant="ghost" size="icon" aria-label="همهٔ یادآورها" title="همهٔ یادآورها" onClick={onManage}><Bell aria-hidden="true" /></Button></div>
    {loading ? <p role="status">در حال دریافت یادآورها…</p> : error ? <div role="alert"><p className="dash-error">{error}</p><Button variant="outline" onClick={() => setRevision(n => n + 1)}>تلاش دوباره</Button></div> : items.length ? <ul className="reminders-list">{items.map(item => <li key={item.id}><article className="reminder-card" data-urgency={reminderUrgency(item.occurrence_at)}>
      <h3>{item.title}</h3>
      <p className="reminder-date"><CalendarDays size={18} aria-hidden="true" /><time dateTime={item.occurrence_at}>{formatReminderDate(item.occurrence_at)}</time></p>
      {item.note && <p className="reminder-note">{item.note}</p>}
    </article></li>)}</ul> : <div className="upcoming-empty"><Bell size={24} aria-hidden="true" /><p>تا ۲۴ ساعت آینده یادآوری ندارین.</p></div>}
    {(offset > 0 || hasMore) && <div className="reminder-pagination"><Button variant="outline" disabled={loading || offset === 0} onClick={() => setOffset(n => Math.max(0, n - 50))}>قبلی</Button><Button variant="outline" disabled={loading || !hasMore} onClick={() => setOffset(n => n + 50)}>بعدی</Button></div>}
  </section>;
}
