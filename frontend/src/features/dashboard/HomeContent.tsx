import { useState } from "react";
import type { Destination } from "@/components/BottomNavigation";
import { useActiveFamily } from "../families/ActiveFamily";
import { UpcomingReminders } from "../reminders/UpcomingReminders";
import { PendingShopping } from "../shopping/PendingShopping";
import { ShoppingItems } from "../shopping/ShoppingItems";
import type { ShoppingList } from "../shopping/ShoppingListCard";
import { FamilyWallet } from "./FamilyWallet";

export function HomeContent({ userId, onNavigate }: { userId: string; onNavigate: (page: Destination) => void }) {
  const { selected } = useActiveFamily();
  return <HomeBody key={`${userId}:${selected}`} userId={userId} onNavigate={onNavigate} />;
}

function HomeBody({ userId, onNavigate }: { userId: string; onNavigate: (page: Destination) => void }) {
  const [active, setActive] = useState<ShoppingList | null>(null);
  const [revision, setRevision] = useState(0);
  if (active) return <ShoppingItems key={active.id} listId={active.id} listName={active.name}
    backLabel="بازگشت به خانه" onBack={() => setActive(null)} onFamilies={() => onNavigate("families")} />;
  return <>
    <FamilyWallet key={revision} userId={userId} /><hr className="dash-section-divider" />
    <UpcomingReminders onManage={() => onNavigate("reminders")} />
    <PendingShopping onOpen={setActive} onComplete={() => setRevision(value => value + 1)} />
  </>;
}
