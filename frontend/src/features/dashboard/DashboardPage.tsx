import { lazy, Suspense } from "react";
import { Management } from "../money-locations/Management";
import { FamilyWallet } from "./FamilyWallet";
import { ReferenceArtwork } from "../landing/ReferenceArtwork";
import { AccountMenu } from "../auth/AccountMenu";
import type { User } from "../auth/api";
import "./dashboard.css";

const Reports = lazy(() => import("../reports/Reports").then(module => ({ default: module.Reports })));
type Page = "home" | "reports" | "budgets";
export function DashboardPage({ user, page }: { user: User; page: Page; onNavigate: (page: Page) => void }) {
  return <div className="dash-shell">
    <a className="skip-link" href="#dashboard-main">رفتن به محتوای اصلی</a>
    <header className="dash-header"><a href="/" aria-label="مابان، صفحهٔ اصلی"><ReferenceArtwork variant="brand" /></a><AccountMenu /></header>
    <main id="dashboard-main" className="dash-main">
      {page === "home" && <FamilyWallet userId={user.id} />}
      {page === "reports" && <Suspense fallback={<p role="status">در حال آماده‌سازی گزارش…</p>}><Reports key={user.id} /></Suspense>}
      {page === "budgets" && <><div className="dash-welcome"><h1 tabIndex={-1}>مدیریت</h1></div><Management userId={user.id} /></>}
    </main>
  </div>;
}
