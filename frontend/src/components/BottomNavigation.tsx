import { House, ChartNoAxesCombined, Settings2 } from "lucide-react";
import "./bottom-navigation.css";

const items = [
  { id: "home", label: "خانه", icon: House, href: "/dashboard" },
  { id: "budgets", label: "مدیریت", icon: Settings2, href: "/dashboard?page=budgets" },
  { id: "reports", label: "گزارش", icon: ChartNoAxesCombined, href: "/dashboard?page=reports" },
] as const;
export type Destination = typeof items[number]["id"] | "plants" | "families" | "finance" | "reminders";

export function BottomNavigation({ active, onNavigate }: {
  active: Destination;
  onNavigate?: (page: Destination) => void;
}) {
  const selected = active === "families" || active === "plants" || active === "finance" || active === "reminders" ? "budgets" : active;
  return <nav className="dash-nav" data-active={selected} aria-label="ناوبری اصلی">
    {items.map(({ id, label, icon: Icon, href }) => <a key={id} href={href}
      aria-current={selected === id ? "page" : undefined}
      onClick={event => {
        if (onNavigate && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
          event.preventDefault(); onNavigate(id);
        }
      }}><span><Icon size={22} aria-hidden="true" /></span>{label}</a>)}
  </nav>;
}
