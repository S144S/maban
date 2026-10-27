import React from "react";
import ReactDOM from "react-dom/client";
import { LandingPage } from "./features/landing/LandingPage";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LandingPage />
  </React.StrictMode>,
);
