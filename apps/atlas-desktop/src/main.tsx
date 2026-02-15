/**
 * main.tsx — Vite entry point for Atlas Desktop.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/globals.css";

console.log("🚀 Atlas Desktop: main.tsx loaded");

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

console.log("🚀 Atlas Desktop: Creating React root");

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
  console.log("✅ Atlas Desktop: React root rendered");
} catch (error) {
  console.error("❌ Atlas Desktop render error:", error);
  document.body.innerHTML = `
    <div style="padding: 20px; color: red; font-family: monospace;">
      <h1>Render Error</h1>
      <pre>${error}</pre>
    </div>
  `;
}
