import React from "react";
import { createRoot } from "react-dom/client";
import { Chrome } from "./shared";
import { Lab } from "./pages/Lab";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Chrome page="lab"><Lab /></Chrome>
  </React.StrictMode>,
);
