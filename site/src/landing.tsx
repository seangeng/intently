import React from "react";
import { createRoot } from "react-dom/client";
import { Chrome } from "./shared";
import { Landing } from "./pages/Landing";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Chrome page="home"><Landing /></Chrome>
  </React.StrictMode>,
);
