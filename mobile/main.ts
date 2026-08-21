import {
  EWalletPresentationMode,
  OWSProxy,
} from "@1shotapi/ows-provider";
import {
  readWalletConnectUriFromLocation,
  startWalletConnectBridge,
  type WalletConnectBridge,
} from "./walletConnect";

/**
 * First-party Host Layer page: mobile PWA + WalletConnect target.
 * Embeds Branding via Inline OWSProxy and bridges WC ↔ EIP-1193.
 */

const statusEl = document.getElementById("status")!;
const container = document.getElementById("wallet-container")!;
const uriInput = document.getElementById("uri-input") as HTMLInputElement;
const pairBtn = document.getElementById("pair-btn") as HTMLButtonElement;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (!window.location.pathname.startsWith("/mobile")) return;
  void navigator.serviceWorker.register("/mobile/sw.js", {
    scope: "/mobile/",
  }).catch((error) => {
    console.warn("[mobile] service worker registration failed", error);
  });
}

async function pairFromInput(bridge: WalletConnectBridge): Promise<void> {
  const uri = uriInput.value.trim();
  if (!uri) {
    setStatus("Paste a wc: URI first", true);
    return;
  }
  pairBtn.disabled = true;
  try {
    await bridge.pair(uri);
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : String(error),
      true,
    );
  } finally {
    pairBtn.disabled = false;
  }
}

async function main(): Promise<void> {
  registerServiceWorker();

  setStatus("Connecting to wallet…");
  const walletUrl = new URL("/", window.location.origin).href;

  const proxy = await OWSProxy.create(container, walletUrl, {
    presentationMode: EWalletPresentationMode.Inline,
    classList: ["oneshot-ows-mobile-host"],
  });

  try {
    await proxy.rpc("configure", {
      copy: { productName: "1Shot Wallet" },
      features: { hideCloseBox: true },
    });
  } catch (error) {
    console.warn("[mobile] configure failed", error);
  }

  setStatus("Starting WalletConnect…");
  const bridge = await startWalletConnectBridge(proxy, setStatus);
  setStatus(
    bridge.getActiveSessionCount() > 0
      ? `${bridge.getActiveSessionCount()} active session(s)`
      : "Ready — paste a wc: URI or open with ?uri=",
  );

  pairBtn.addEventListener("click", () => {
    void pairFromInput(bridge);
  });
  uriInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      void pairFromInput(bridge);
    }
  });

  const fromLocation = readWalletConnectUriFromLocation();
  if (fromLocation) {
    uriInput.value = fromLocation;
    try {
      await bridge.pair(fromLocation);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : String(error),
        true,
      );
    }
  }
}

void main().catch((error) => {
  console.error("[mobile] boot failed", error);
  setStatus(
    error instanceof Error ? error.message : String(error),
    true,
  );
  pairBtn.disabled = true;
});
