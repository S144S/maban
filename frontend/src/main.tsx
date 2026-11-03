import React from "react";
import ReactDOM from "react-dom/client";
import { LandingPage } from "./features/landing/LandingPage";
import { AuthPage } from "./features/auth/AuthPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ProtectedPage } from "./features/auth/ProtectedPage";
import { AccountPage } from "./features/auth/AccountPage";
import { AdminUsersPage } from "./features/auth/AdminUsersPage";
import { FamiliesPage } from "./features/families/FamiliesPage";
import { InvitePage } from "./features/families/InvitePage";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/^\/dashboard\/?$/.test(window.location.pathname) ? <ProtectedPage>{user => <DashboardPage user={user} />}</ProtectedPage>
      : /^\/families\/?$/.test(window.location.pathname) ? <ProtectedPage>{user => <FamiliesPage user={user} />}</ProtectedPage>
      : /^\/invite\/?$/.test(window.location.pathname) ? <ProtectedPage>{() => <InvitePage />}</ProtectedPage>
      : /^\/account\/?$/.test(window.location.pathname) ? <ProtectedPage>{user => <AccountPage user={user} />}</ProtectedPage>
      : /^\/admin\/users\/?$/.test(window.location.pathname) ? <ProtectedPage admin>{user => <AdminUsersPage user={user} />}</ProtectedPage>
      : /^\/(login|signup|forgot-password)\/?$/.test(window.location.pathname) ? <AuthPage /> : <LandingPage />}
  </React.StrictMode>,
);
