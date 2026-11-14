import { lazy, Suspense } from "react";
import { ManagementBack } from "@/components/ManagementBack";
import { Management } from "../money-locations/Management";
import { ManagementHub } from "./ManagementHub";
import { ReferenceArtwork } from "../landing/ReferenceArtwork";
import { AccountMenu } from "../auth/AccountMenu";
import type { User } from "../auth/api";
import "./dashboard.css";
import type { Destination } from "@/components/BottomNavigation";

const Shopping = lazy(() => import("../shopping/Shopping").then(module => ({ default: module.Shopping })));
const Reports = lazy(() => import("../reports/Reports").then(module => ({ default: module.Reports })));
const Plants = lazy(() => import("../plants/Plants").then(module => ({ default: module.Plants })));
const Reminders = lazy(() => import("../reminders/Reminders").then(module => ({ default: module.Reminders })));
const HomeContent = lazy(() => import("./HomeContent").then(module => ({ default: module.HomeContent })));
type Page = "home" | "reports" | "budgets" | "plants" | "finance" | "reminders" | "purchases";
export function DashboardPage({ user, page, onNavigate }: { user: User; page: Page; onNavigate: (page: Destination) => void }) {
  return <div className="dash-shell">
    <a className="skip-link" href="#dashboard-main">رفتن به محتوای اصلی</a>
    <header className="dash-header"><a href="/" aria-label="مابان، صفحهٔ اصلی"><ReferenceArtwork variant="brand" /></a><AccountMenu /></header>
    <main id="dashboard-main" className="dash-main">
      {page === "home" && <Suspense fallback={<p role="status">در حال آماده‌سازی خانه…</p>}><HomeContent userId={user.id} onNavigate={onNavigate} /></Suspense>}
      {page === "reports" && <Suspense fallback={<p role="status">در حال آماده‌سازی گزارش…</p>}><Reports key={user.id} /></Suspense>}
      {page === "budgets" && <ManagementHub onNavigate={onNavigate} />}
      {page === "purchases" && <Suspense fallback={<p role="status">در حال آماده‌سازی لیست خرید…</p>}><Shopping onBack={() => onNavigate("budgets")} onFamilies={() => onNavigate("families")} /></Suspense>}
      {page === "finance" && <><div className="dash-welcome management-title-row"><h1 tabIndex={-1}>مالی</h1><ManagementBack onBack={() => onNavigate("budgets")} /></div><Management userId={user.id} /></>}
      {page === "reminders" && <><div className="dash-welcome management-title-row"><h1 tabIndex={-1}>یادآورها</h1><ManagementBack onBack={() => onNavigate("budgets")} /></div><Suspense fallback={<p role="status">در حال آماده‌سازی یادآورها…</p>}><Reminders key={user.id} /></Suspense></>}
      {page === "plants" && <Suspense fallback={<p role="status">در حال آماده‌سازی گلدون‌ها…</p>}><Plants onFamilies={() => onNavigate("families")} onBack={() => onNavigate("budgets")} /></Suspense>}
    </main>
  </div>;
}
