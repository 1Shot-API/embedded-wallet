import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StyleProvider } from "./style/StyleProvider";
import { styleController } from "./style/styleController";
import { WalletProvider } from "./wallet/WalletProvider";
// Registers Arc mainnet Smart Accounts env (missing from kit deployments registry).
import "./lib/implementations/utils/registerSmartAccountsEnvironments";
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
