import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { env } from "./envFrontend";

declare global {
  interface Window {
    env: typeof env;
  }
}

if (env.env !== "production") {
  window.env = env;
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
