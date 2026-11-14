import { ChevronLeft, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ShoppingList = { id: string; name: string; pending_count: number; purchased_count: number };

export function ShoppingListCard({ list, onOpen, onComplete }: {
  list: ShoppingList; onOpen: () => void; onComplete: () => void;
}) {
  return <li className="shopping-list-card">
    <button type="button" className="shopping-list-open" onClick={onOpen}>
      <ListChecks aria-hidden="true" /><span><strong><bdi>{list.name}</bdi></strong>
      <span>{list.pending_count.toLocaleString("fa-IR")} کالا برای خرید · {list.purchased_count.toLocaleString("fa-IR")} خریدشده</span>
      <progress aria-label={`پیشرفت ${list.name}`} value={list.purchased_count} max={Math.max(1, list.pending_count + list.purchased_count)} /></span><ChevronLeft aria-hidden="true" />
    </button>
    {list.pending_count + list.purchased_count > 0 && <Button variant="outline" className="shopping-complete"
      aria-label={`خریدم؛ ${list.name}`} onClick={onComplete}><ListChecks aria-hidden="true" />خریدم</Button>}
  </li>;
}
