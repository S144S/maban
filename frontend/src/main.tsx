import React from "react";
import ReactDOM from "react-dom/client";
import { LandingPage } from "./features/landing/LandingPage";
import { AuthPage } from "./features/auth/AuthPage";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/^\/(login|signup|forgot-password)\/?$/.test(window.location.pathname) ? <AuthPage /> : <LandingPage />}
  </React.StrictMode>,
);
