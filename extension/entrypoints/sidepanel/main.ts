/**
 * SHELVED: the wallet refuses to be embedded by a browser-extension page, so
 * `OWSProxy.create` below never completes its handshake, and the
 * `forwardEip1193` RPC used by `runOriginBound` no longer exists. Known open
 * issue if this is revived: a background timeout (120 s) does not cancel the
 * request here, so it can still prompt later. See `extension/README.md`.
 */
import {
  EWalletPresentationMode,
  OWSProxy,
} from "@1shotapi/ows-provider";

import { queryActiveDappTab } from "../../src/shared/activeTab";
import {
  isOriginBoundMethod,
  WALLET_FORWARD_EIP1193_RPC_METHOD,
  type ExtEip1193ResponseMessage,
  type ExtEip1193RoutedRequestMessage,
  type ExtRuntimeMessage,
  type ExtStatusResponse,
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
const requestOriginLine = document.getElementById("request-origin")!;
const consentEl = document.getElementById("consent")!;
const consentOriginEl = document.getElementById("consent-origin")!;
const consentAllowBtn = document.getElementById(
  "consent-allow",
) as HTMLButtonElement;
const consentDenyBtn = document.getElementById(
  "consent-deny",
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

/**
 * Origin-bound requests run one at a time: the wallet shows one prompt, and
 * the header names exactly the site behind it. `current` is the request the
 * wallet is handling now; `waiting` counts requests queued behind it.
 */
let originBoundChain: Promise<unknown> = Promise.resolve();
let current: { origin: string; method: string } | null = null;
let waiting = 0;

function renderRequestOrigin(): void {
  if (!current) {
    requestOriginLine.classList.add("hidden");
    requestOriginLine.classList.remove("mismatch");
    requestOriginLine.textContent = "";
    return;
  }
  requestOriginLine.textContent =
    `Request from ${current.origin} · ${current.method}` +
    (waiting > 0 ? ` (+${waiting} waiting)` : "");
  requestOriginLine.classList.remove("hidden");
  requestOriginLine.classList.toggle(
    "mismatch",
    Boolean(activeOrigin) && current.origin !== activeOrigin,
  );
}

/** Allow / Deny for a connect request. Called only from the serialized lane. */
function askConnectConsent(origin: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    consentOriginEl.textContent = origin;
    consentEl.classList.remove("hidden");
    const settle = (approved: boolean) => {
      consentAllowBtn.removeEventListener("click", onAllow);
      consentDenyBtn.removeEventListener("click", onDeny);
      consentEl.classList.add("hidden");
      consentOriginEl.textContent = "";
      resolve(approved);
    };
    const onAllow = () => settle(true);
    const onDeny = () => settle(false);
    consentAllowBtn.addEventListener("click", onAllow);
    consentDenyBtn.addEventListener("click", onDeny);
  });
}

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
  renderRequestOrigin();

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
          status.connected ? "connected" : null,
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
      await created.rpc("configure", {
        copy: { productName: "1Shot Wallet" },
        features: { hideCloseBox: true },
      });
    } catch (error) {
      console.warn("[1Shot sidepanel] configure failed", error);
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

function reply(payload: ExtEip1193ResponseMessage): void {
  port.postMessage(payload);
}

function replyError(
  message: ExtEip1193RoutedRequestMessage,
  error: unknown,
): void {
  const err = error as { code?: number; message?: string; data?: unknown };
  console.warn("[1Shot sidepanel] eip1193 error", message.method, err);
  reply({
    type: "eip1193-response",
    tabId: message.tabId,
    id: message.id,
    error: {
      code: typeof err.code === "number" ? err.code : 4001,
      message:
        err.message || (error instanceof Error ? error.message : String(error)),
      data: err.data,
    },
  });
}

/** Chain reads: no prompt, no requester identity needed, may overlap. */
async function runPassthrough(
  message: ExtEip1193RoutedRequestMessage,
): Promise<void> {
  try {
    const live = await ensureProxy();
    const result = await live.ethereum.request({
      method: message.method,
      params: message.params as never,
    });
    reply({
      type: "eip1193-response",
      tabId: message.tabId,
      id: message.id,
      result,
    });
  } catch (error) {
    replyError(message, error);
  }
}

/**
 * Prompts and connection-scoped reads: one at a time, forwarded with the
 * browser-attested origin so the wallet attributes the request to the page.
 */
async function runOriginBound(
  message: ExtEip1193RoutedRequestMessage,
): Promise<void> {
  waiting = Math.max(0, waiting - 1);
  current = { origin: message.origin, method: message.method };
  renderRequestOrigin();
  try {
    if (message.requiresConsent) {
      const approved = await askConnectConsent(message.origin);
      if (!approved) {
        reply({
          type: "eip1193-response",
          tabId: message.tabId,
          id: message.id,
          error: {
            code: 4001,
            message: `User rejected connecting ${message.origin}`,
          },
        });
        return;
      }
    }
    const live = await ensureProxy();
    console.info("[1Shot sidepanel] eip1193", message.method, message.id);
    const result = await live.rpc(WALLET_FORWARD_EIP1193_RPC_METHOD, {
      origin: message.origin,
      method: message.method,
      params: message.params,
    });
    console.info("[1Shot sidepanel] eip1193 ok", message.method, message.id);
    reply({
      type: "eip1193-response",
      tabId: message.tabId,
      id: message.id,
      result,
    });
  } catch (error) {
    replyError(message, error);
  } finally {
    current = null;
    renderRequestOrigin();
  }
}

function handleRequest(message: ExtEip1193RoutedRequestMessage): void {
  if (!isOriginBoundMethod(message.method)) {
    void runPassthrough(message);
    return;
  }
  waiting += 1;
  renderRequestOrigin();
  const run = () => runOriginBound(message);
  originBoundChain = originBoundChain.then(run, run);
}

port.onMessage.addListener((raw) => {
  const message = raw as ExtRuntimeMessage;
  if (message.type !== "eip1193-request") return;
  const routed = message as Partial<ExtEip1193RoutedRequestMessage>;
  if (
    typeof routed.tabId !== "number" ||
    routed.tabId <= 0 ||
    typeof routed.origin !== "string" ||
    !routed.origin
  ) {
    console.warn(
      "[1Shot sidepanel] dropping eip1193-request without tab id / origin",
    );
    return;
  }
  handleRequest(routed as ExtEip1193RoutedRequestMessage);
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
