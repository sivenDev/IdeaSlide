import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installTauriBlobDownloadBridge } from "./lib/tauriBlobDownload";
import "./index.css";

installTauriBlobDownloadBridge();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
