import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { initEmbedHeight } from "./lib/embed.js";
import "./styles/tokens.css";
import "./styles/app.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Report height to the host page when embedded in an iframe (seamless auto-resize).
initEmbedHeight();
