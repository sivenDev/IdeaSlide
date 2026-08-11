import React from "react";
import { createRoot } from "react-dom/client";
import { DemoApp } from "./app/DemoApp.jsx";
import "./styles.css";

createRoot(document.getElementById("app")).render(<React.StrictMode><DemoApp /></React.StrictMode>);
