import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StyleProvider, styleController } from "./style";
import { WalletProvider } from "./wallet/WalletProvider";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root not found");
}

styleController.init();

createRoot(root).render(
  <StyleProvider>
    <WalletProvider>
      <App />
    </WalletProvider>
  </StyleProvider>,
);
