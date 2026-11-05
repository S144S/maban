import React from "react";
import ReactDOM from "react-dom/client";
import { LandingPage } from "./features/landing/LandingPage";
import { AuthPage } from "./features/auth/AuthPage";
import { MemberApp } from "./components/MemberApp";
import { ProtectedPage } from "./features/auth/ProtectedPage";
import { AccountPage } from "./features/auth/AccountPage";
import { AdminUsersPage } from "./features/auth/AdminUsersPage";
import { InvitePage } from "./features/families/InvitePage";
import "./styles.css";

console.info(`%cClient Version: ${__APP_VERSION__}`, "color: #2478ff; font-size: 22px; font-weight: bold; font-family: monospace;");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/^\/(dashboard|families)\/?$/.test(window.location.pathname) ? <ProtectedPage>{user => <MemberApp user={user} />}</ProtectedPage>
      : /^\/invite\/?$/.test(window.location.pathname) ? <ProtectedPage>{() => <InvitePage />}</ProtectedPage>
      : /^\/account\/?$/.test(window.location.pathname) ? <ProtectedPage>{user => <AccountPage user={user} />}</ProtectedPage>
      : /^\/admin\/users\/?$/.test(window.location.pathname) ? <ProtectedPage admin>{user => <AdminUsersPage user={user} />}</ProtectedPage>
      : /^\/(login|signup|forgot-password)\/?$/.test(window.location.pathname) ? <AuthPage /> : <LandingPage />}
  </React.StrictMode>,
);
