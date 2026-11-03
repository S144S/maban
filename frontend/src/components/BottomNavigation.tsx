import { House, ListFilter, Wallet, Users } from "lucide-react";
import "./bottom-navigation.css";

const items = [
  { id: "home", label: "خانه", icon: House, href: "/dashboard" },
  { id: "transactions", label: "تراکنش‌ها", icon: ListFilter, href: "/dashboard?page=transactions" },
  { id: "budgets", label: "بودجه", icon: Wallet, href: "/dashboard?page=budgets" },
  { id: "families", label: "خانواده", icon: Users, href: "/families" },
] as const;
type Destination = typeof items[number]["id"];

export function BottomNavigation({ active, onNavigate }: {
  active: Destination;
  onNavigate?: (page: Exclude<Destination, "families">) => void;
}) {
  return <nav className="dash-nav" data-active={active} aria-label="ناوبری اصلی">
    {items.map(({ id, label, icon: Icon, href }) => <a key={id} href={href}
      aria-current={active === id ? "page" : undefined}
      onClick={event => {
        if (onNavigate && id !== "families" && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
          event.preventDefault(); onNavigate(id);
        }
      }}><span><Icon size={22} aria-hidden="true" /></span>{label}</a>)}
  </nav>;
}
