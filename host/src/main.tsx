import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root not found");
}

// No StrictMode: OWSProxy.create is a one-shot iframe handshake.
createRoot(root).render(<App />);
