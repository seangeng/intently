import React from "react";
import { createRoot } from "react-dom/client";
import { Chrome } from "./shared";
import { Docs } from "./pages/Docs";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Chrome page="docs"><Docs /></Chrome>
  </React.StrictMode>,
);
