import {
  EWalletPresentationMode,
  OWSProxy,
} from "@1shotapi/ows-provider";
import { queryActiveDappTab } from "../../src/shared/activeTab";
import type {
  ExtEip1193ResponseMessage,
  ExtEip1193RoutedRequestMessage,
  ExtRuntimeMessage,
  ExtStatusResponse,
} from "../../src/shared/protocol";
import { getSettings } from "../../src/shared/storage";

const statusEl = document.getElementById("status")!;
const container = document.getElementById("wallet-container")!;
const originLine = document.getElementById("origin-line")!;
const injectStatus = document.getElementById("inject-status")!;
const injectBtn = document.getElementById("inject-btn") as HTMLButtonElement;
const allowlistBtn = document.getElementById(
  "allowlist-btn",
) as HTMLButtonElement;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
  statusEl.classList.toggle("hidden", false);
}

function hideStatus(): void {
  statusEl.classList.add("hidden");
}

function setInjectStatus(
  message: string,
  kind: "ok" | "error" | "" = "",
): void {
  injectStatus.textContent = message;
  injectStatus.classList.toggle("error", kind === "error");
  injectStatus.classList.toggle("ok", kind === "ok");
}

let proxy: OWSProxy | null = null;
let connecting: Promise<OWSProxy> | null = null;
let activeTabId: number | undefined;
let activeOrigin: string | undefined;
const port = browser.runtime.connect({ name: "sidepanel" });

async function refreshActiveTab(): Promise<void> {
  const tab = await queryActiveDappTab();
  activeTabId = tab?.id;
  try {
    activeOrigin = tab?.url ? new URL(tab.url).origin : undefined;
  } catch {
    activeOrigin = undefined;
  }
  originLine.textContent = activeOrigin ?? "No active tab — focus a dApp window";
  injectBtn.disabled = activeTabId == null;
  allowlistBtn.disabled = !activeOrigin || activeTabId == null;

  if (activeTabId != null) {
    const status = (await browser.runtime.sendMessage({
      type: "get-status",
      tabId: activeTabId,
    } satisfies ExtRuntimeMessage)) as ExtStatusResponse;
    if (status?.ok) {
      setInjectStatus(
        [
          status.injected ? "Provider injected" : "Not injected on this tab",
          status.allowlisted ? "allowlisted" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
    }
  } else {
    setInjectStatus("Focus a normal browser tab (not this sidebar), then retry");
  }
}

async function ensureProxy(): Promise<OWSProxy> {
  if (proxy) return proxy;
  if (connecting) return connecting;

  connecting = (async () => {
    const settings = await getSettings();
    setStatus(`Connecting to ${settings.walletUrl}…`);

    const created = await OWSProxy.create(container, settings.walletUrl, {
      presentationMode: EWalletPresentationMode.Inline,
      classList: ["oneshot-ows-extension-host"],
    });

    try {
      await created.rpc("setStyle", {
        copy: { productName: "1Shot Wallet" },
        features: { hideCloseBox: true },
      });
    } catch (error) {
      console.warn("[1Shot sidepanel] setStyle failed", error);
    }

    created.ethereum.on("accountsChanged", (...params: unknown[]) => {
      port.postMessage({
        type: "eip1193-event",
        event: "accountsChanged",
        params,
      } satisfies ExtRuntimeMessage);
    });
    created.ethereum.on("chainChanged", (...params: unknown[]) => {
      port.postMessage({
        type: "eip1193-event",
        event: "chainChanged",
        params,
      } satisfies ExtRuntimeMessage);
    });
    created.ethereum.on("connect", (...params: unknown[]) => {
      port.postMessage({
        type: "eip1193-event",
        event: "connect",
        params,
      } satisfies ExtRuntimeMessage);
    });
    created.ethereum.on("disconnect", (...params: unknown[]) => {
      port.postMessage({
        type: "eip1193-event",
        event: "disconnect",
        params,
      } satisfies ExtRuntimeMessage);
    });

    proxy = created;
    hideStatus();
    void browser.runtime.sendMessage({ type: "sidepanel-ready" });
    return created;
  })().catch((error) => {
    proxy = null;
    connecting = null;
    throw error;
  });

  return connecting;
}

async function handleRequest(
  message: ExtEip1193RoutedRequestMessage,
): Promise<void> {
  const reply = (payload: ExtEip1193ResponseMessage) => {
    port.postMessage(payload);
  };

  try {
    const live = await ensureProxy();
    console.info("[1Shot sidepanel] eip1193", message.method, message.id);
    const result = await live.ethereum.request({
      method: message.method,
      params: message.params as never,
    });
    console.info("[1Shot sidepanel] eip1193 ok", message.method, message.id);
    reply({
      type: "eip1193-response",
      tabId: message.tabId,
      id: message.id,
      result,
    });
  } catch (error) {
    const err = error as { code?: number; message?: string; data?: unknown };
    console.warn("[1Shot sidepanel] eip1193 error", message.method, err);
    reply({
      type: "eip1193-response",
      tabId: message.tabId,
      id: message.id,
      error: {
        code: typeof err.code === "number" ? err.code : 4001,
        message:
          err.message ||
          (error instanceof Error ? error.message : String(error)),
        data: err.data,
      },
    });
  }
}

port.onMessage.addListener((raw) => {
  const message = raw as ExtRuntimeMessage;
  if (message.type !== "eip1193-request") return;
  if (typeof message.tabId !== "number" || message.tabId <= 0) {
    console.warn("[1Shot sidepanel] dropping eip1193-request without tab id");
    return;
  }
  void handleRequest(message as ExtEip1193RoutedRequestMessage);
});

injectBtn.addEventListener("click", () => {
  void (async () => {
    await refreshActiveTab();
    if (activeTabId == null) {
      setInjectStatus("No dApp tab focused — click the Uniswap tab first", "error");
      return;
    }
    setInjectStatus("Injecting…");
    const result = (await browser.runtime.sendMessage({
      type: "inject-tab",
      tabId: activeTabId,
    } satisfies ExtRuntimeMessage)) as { ok: boolean; error?: string };
    if (!result.ok) {
      setInjectStatus(result.error ?? "Inject failed", "error");
      return;
    }
    setInjectStatus(
      "Injected — reload the dApp tab if Connect still hides 1Shot",
      "ok",
    );
  })();
});

allowlistBtn.addEventListener("click", () => {
  void (async () => {
    await refreshActiveTab();
    if (!activeOrigin || activeTabId == null) {
      setInjectStatus("No dApp tab focused — click the Uniswap tab first", "error");
      return;
    }
    await browser.runtime.sendMessage({
      type: "add-allowlist-origin",
      origin: activeOrigin,
    } satisfies ExtRuntimeMessage);
    const result = (await browser.runtime.sendMessage({
      type: "inject-tab",
      tabId: activeTabId,
    } satisfies ExtRuntimeMessage)) as { ok: boolean; error?: string };
    if (!result.ok) {
      setInjectStatus(result.error ?? "Allowlisted but inject failed", "error");
      return;
    }
    setInjectStatus(`Always inject on ${activeOrigin}`, "ok");
  })();
});

browser.tabs.onActivated.addListener(() => {
  void refreshActiveTab();
});
browser.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    void refreshActiveTab();
  }
});
browser.windows.onFocusChanged.addListener(() => {
  void refreshActiveTab();
});

void (async () => {
  void refreshActiveTab();
  try {
    await ensureProxy();
  } catch (error) {
    setStatus(
      error instanceof Error
        ? `Failed to load wallet: ${error.message}`
        : "Failed to load wallet",
      true,
    );
  }
})();

/** Surface hung Postmate/iframe loads instead of infinite “Loading wallet…” */
window.setTimeout(() => {
  if (proxy || statusEl.classList.contains("hidden")) return;
  if (statusEl.classList.contains("error")) return;
  setStatus(
    `${statusEl.textContent || "Loading wallet…"} — still waiting. Check Settings → Wallet iframe URL (must be https://…), then reopen the sidebar.`,
    true,
  );
}, 20_000);