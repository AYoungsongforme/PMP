import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SiteApp from "./SiteApp";
import "../index.css";
import "./site.css";

const container = document.getElementById("root");
if (!container) throw new Error("找不到 #root");

createRoot(container).render(
  <StrictMode>
    <SiteApp />
  </StrictMode>
);
