import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/http";
import { useActiveFamily } from "../families/ActiveFamily";
import type { Family } from "../families/api";
import { ShoppingListCard, type ShoppingList } from "./ShoppingListCard";
import { ListCheckout } from "./ListCheckout";
import "./shopping.css";

export function PendingShopping({ onOpen, onComplete }: {
  onOpen: (list: ShoppingList) => void; onComplete: () => void;
}) {
  const { selected, setSelected } = useActiveFamily();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [checkout, setCheckout] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true); setError("");
    async function load() {
      if (!selected) {
        const result = await api<{ families: Family[] }>("/families", { signal });
        if (!signal.aborted && result.families.length) setSelected(result.families[0].id);
        return;
      }
      const result = await api<{ lists: ShoppingList[]; has_more: boolean }>(
        `/families/${selected}/shopping/lists?status=pending&offset=${offset}`, { signal });
      if (signal.aborted) return;
      if (offset && !result.lists.length) { setOffset(0); return; }
      setLists(result.lists); setHasMore(result.has_more);
    }
    void load().catch(err => { if (!signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, setSelected, offset, revision]);

  return <>
    <p className="shopping-notice" role="status">{notice}</p>
    {(loading || error || lists.length > 0) && <section className="shopping-page shopping-home" aria-labelledby="home-shopping-title">
      <div className="shopping-list-heading"><h2 id="home-shopping-title">خریدهای خونه</h2></div>
      {loading ? <p role="status">در حال دریافت لیست‌های خرید…</p> : error ? <div className="shopping-error" role="alert"><p>{error}</p>
        <Button variant="outline" onClick={() => setRevision(value => value + 1)}>تلاش دوباره</Button></div> : <>
        <ul className="shopping-list">{lists.map(list => <ShoppingListCard key={list.id} list={list} onOpen={() => onOpen(list)}
          onComplete={() => { setNotice(""); setCheckout(list); }} />)}</ul>
        {(offset > 0 || hasMore) && <div className="shopping-pagination"><Button variant="outline" disabled={!offset} onClick={() => setOffset(value => value - 50)}>قبلی</Button>
          <span>صفحهٔ {(offset / 50 + 1).toLocaleString("fa-IR")}</span><Button variant="outline" disabled={!hasMore} onClick={() => setOffset(value => value + 50)}>بعدی</Button></div>}
      </>}
    </section>}
    {checkout && <ListCheckout key={checkout.id} familyId={selected} listId={checkout.id} listName={checkout.name}
      onClose={() => setCheckout(null)} onComplete={() => {
        setCheckout(null); setNotice("لیست خرید تکمیل شد."); setRevision(value => value + 1); onComplete();
      }} />}
  </>;
}
