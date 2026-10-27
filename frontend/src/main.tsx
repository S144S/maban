import React from "react";
import ReactDOM from "react-dom/client";
import { LandingPage } from "./features/landing/LandingPage";
import { AuthPage } from "./features/auth/AuthPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/^\/dashboard\/?$/.test(window.location.pathname) ? <DashboardPage /> : /^\/(login|signup|forgot-password)\/?$/.test(window.location.pathname) ? <AuthPage /> : <LandingPage />}
  </React.StrictMode>,
);
