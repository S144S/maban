import { useEffect, useRef, useState } from "react";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { FamiliesPage } from "@/features/families/FamiliesPage";
import { ActiveFamilyProvider, useActiveFamily } from "@/features/families/ActiveFamily";
import type { User } from "@/features/auth/api";
import { BottomNavigation, type Destination } from "./BottomNavigation";

function currentDestination(): Destination {
  if (/^\/families\/?$/.test(window.location.pathname)) return "families";
  const page = new URLSearchParams(window.location.search).get("page");
  return page === "transactions" ? "reports" : page === "reports" || page === "budgets" ? page : "home";
}

export function MemberApp({ user }: { user: User }) {
  return <ActiveFamilyProvider key={user.id} userId={user.id}><MemberContent user={user} /></ActiveFamilyProvider>;
}

function MemberContent({ user }: { user: User }) {
  const { selected } = useActiveFamily();
  const [active, setActive] = useState<Destination>(currentDestination);
  const [dashboardPage, setDashboardPage] = useState<"home" | "reports" | "budgets">(() => active === "families" ? "home" : active);
  const [familyVisited, setFamilyVisited] = useState(active === "families");
  const content = useRef<HTMLDivElement>(null);
  function select(page: Destination) {
    if (page === "families") setFamilyVisited(true);
    else setDashboardPage(page);
    setActive(page);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => {
      const heading = content.current?.querySelector<HTMLElement>("[data-active-panel='true'] h1");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
  }
  function navigate(page: Destination) {
    if (page === active) return;
    const href = page === "families" ? "/families" : page === "home" ? "/dashboard" : `/dashboard?page=${page}`;
    window.history.pushState(null, "", href);
    select(page);
  }
  useEffect(() => {
    const restore = () => select(currentDestination());
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => { document.title = active === "families" ? "خانواده | مابان" : active === "reports" ? "گزارش مالی | مابان" : "داشبورد | مابان"; }, [active]);
  return <div ref={content}>
    <div hidden={active === "families"} data-active-panel={active !== "families"}>
      <DashboardPage key={selected} user={user} page={dashboardPage} onNavigate={navigate} />
    </div>
    <div hidden={active !== "families"} data-active-panel={active === "families"}>
      {familyVisited && <FamiliesPage user={user} />}
    </div>
    <BottomNavigation active={active} onNavigate={navigate} />
  </div>;
}
