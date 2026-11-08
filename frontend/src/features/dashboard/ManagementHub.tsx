import { Users, Wallet, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Destination } from "@/components/BottomNavigation";

export function ManagementHub({ onNavigate }: { onNavigate: (page: Destination) => void }) {
  return <>
    <div className="dash-welcome"><h1 tabIndex={-1}>مدیریت</h1></div>
    <div className="management-hub" aria-label="بخش‌های مدیریت">
      <Button variant="outline" className="management-family-action" onClick={() => onNavigate("families")}><Users aria-hidden="true" />خانواده</Button>
      <Button variant="outline" className="management-finance-action" onClick={() => onNavigate("finance")}><Wallet aria-hidden="true" />مالی</Button>
      <Button variant="outline" className="management-plants-action" onClick={() => onNavigate("plants")}><Sprout aria-hidden="true" />گیاهان</Button>
    </div>
  </>;
}
