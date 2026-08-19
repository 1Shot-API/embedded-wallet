import { injectProviderIntoTab } from "../src/shared/inject";
import { openWalletUi } from "../src/shared/openWalletUi";
import {
  isInteractiveMethod,
  type ExtEip1193ResponseMessage,
  type ExtEip1193RoutedRequestMessage,
  type ExtRuntimeMessage,
  type ExtStatusResponse,
} from "../src/shared/protocol";
import {
  addAllowlistOrigin,
  getSettings,
  isOriginAllowlisted,
} from "../src/shared/storage";

type PendingRequest = {
  message: ExtEip1193RoutedRequestMessage;
  resolve: (value: ExtEip1193ResponseMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const REQUEST_TIMEOUT_MS = 120_000;
const SIDEPANEL_WAIT_MS = 15_000;

let sidepanelPort: ReturnType<typeof browser.runtime.connect> | null = null;
const pendingById = new Map<string, PendingRequest>();
const queuedWhilePanelBootstraps: PendingRequest[] = [];
let sidepanelReadyWaiters: Array<() => void> = [];

/** Tabs we successfully injected (for event fan-out). */
const injectedTabs = new Set<number>();

function notifySidepanelReady(): void {
  const waiters = sidepanelReadyWaiters;
  sidepanelReadyWaiters = [];
  for (const resolve of waiters) {
    resolve();
  }
}

function waitForSidepanelPort(timeoutMs: number): Promise<boolean> {
  if (sidepanelPort) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sidepanelReadyWaiters = sidepanelReadyWaiters.filter((w) => w !== onReady);
      resolve(false);
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve(true);
    };
    sidepanelReadyWaiters.push(onReady);
  });
}

function attachSidepanelPort(
  port: ReturnType<typeof browser.runtime.connect>,
): void {
  sidepanelPort = port;
  void browser.action.setBadgeText({ text: "" });
  notifySidepanelReady();

  port.onMessage.addListener((raw) => {
    const msg = raw as ExtRuntimeMessage;
    if (msg.type === "eip1193-response") {
      const pending = pendingById.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingById.delete(msg.id);
        pending.resolve(msg);
      }
      return;
    }
    if (msg.type === "eip1193-event") {
      void broadcastEvent(msg.event, msg.params);
    }
  });

  port.onDisconnect.addListener(() => {
    if (sidepanelPort === port) {
      sidepanelPort = null;
    }
    // Do not retry in-flight RPCs: Branding may already have submitted
    // (eth_sendTransaction, etc.) and only the response was lost with the port.
    for (const [, pending] of pendingById) {
      failPending(
        pending,
        "Wallet UI disconnected before the request completed. Retry the request.",
      );
    }
    pendingById.clear();
  });

  flushBootstrapQueue();
}

function failPending(pending: PendingRequest, message: string): void {
  clearTimeout(pending.timer);
  pending.resolve({
    type: "eip1193-response",
    tabId: pending.message.tabId,
    id: pending.message.id,
    error: {
      code: 4900,
      message,
    },
  });
}

function flushBootstrapQueue(): void {
  while (queuedWhilePanelBootstraps.length > 0 && sidepanelPort) {
    const next = queuedWhilePanelBootstraps.shift()!;
    forwardToSidepanel(next);
  }
}

function forwardToSidepanel(pending: PendingRequest): void {
  if (!sidepanelPort) {
    queuedWhilePanelBootstraps.push(pending);
    return;
  }
  pendingById.set(pending.message.id, pending);
  try {
    sidepanelPort.postMessage(pending.message);
  } catch (error) {
    console.warn("[1Shot] sidepanel postMessage failed; re-queueing", error);
    pendingById.delete(pending.message.id);
    sidepanelPort = null;
    queuedWhilePanelBootstraps.push(pending);
  }
}

/**
 * Ensure a live sidepanel port before forwarding RPC.
 *
 * Important: do NOT call openWalletUi() when a port is already connected —
 * Firefox sidebarAction.open() can reload the panel and drop in-flight
 * postMessage traffic (Connect then spins forever with no Branding UI).
 */
async function ensureSidepanelForRequest(
  message: ExtEip1193RoutedRequestMessage,
): Promise<void> {
  if (sidepanelPort) {
    return;
  }

  const interactive = isInteractiveMethod(message.method);
  try {
    await openWalletUi();
    if (interactive) {
      await browser.action.setBadgeText({ text: "" });
    }
  } catch (error) {
    console.warn("[1Shot] openWalletUi failed", error);
    if (interactive) {
      try {
        await browser.action.setBadgeText({ text: "!" });
        await browser.action.setBadgeBackgroundColor({ color: "#3d8bfd" });
      } catch {
        // ignore
      }
    }
  }

  const ready = await waitForSidepanelPort(SIDEPANEL_WAIT_MS);
  if (!ready) {
    console.warn("[1Shot] sidepanel did not connect in time");
  }
}

async function handleEip1193Request(
  message: ExtEip1193RoutedRequestMessage,
): Promise<ExtEip1193ResponseMessage> {
  await ensureSidepanelForRequest(message);

  return new Promise<ExtEip1193ResponseMessage>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingById.delete(message.id);
      const idx = queuedWhilePanelBootstraps.findIndex(
        (p) => p.message.id === message.id,
      );
      if (idx >= 0) queuedWhilePanelBootstraps.splice(idx, 1);
      resolve({
        type: "eip1193-response",
        tabId: message.tabId,
        id: message.id,
        error: {
          code: -32603,
          message:
            "Wallet UI timed out — open the 1Shot side panel (toolbar → Open wallet panel) and try again.",
        },
      });
    }, REQUEST_TIMEOUT_MS);

    const pending: PendingRequest = { message, resolve, reject, timer };
    forwardToSidepanel(pending);
  });
}

async function broadcastEvent(event: string, params: unknown[]): Promise<void> {
  const payload: ExtRuntimeMessage = {
    type: "eip1193-event",
    event,
    params,
  };
  for (const tabId of injectedTabs) {
    try {
      await browser.tabs.sendMessage(tabId, payload);
    } catch {
      injectedTabs.delete(tabId);
    }
  }
}

async function statusForTab(tabId?: number): Promise<ExtStatusResponse> {
  const settings = await getSettings();
  if (tabId == null) {
    return {
      ok: true,
      injected: false,
      allowlisted: false,
      walletUrl: settings.walletUrl,
      preferOneshot: settings.preferOneshot,
    };
  }
  try {
    const tab = await browser.tabs.get(tabId);
    const origin = tab.url ? new URL(tab.url).origin : undefined;
    return {
      ok: true,
      injected: injectedTabs.has(tabId),
      origin,
      allowlisted: origin
        ? isOriginAllowlisted(origin, settings.allowlist)
        : false,
      walletUrl: settings.walletUrl,
      preferOneshot: settings.preferOneshot,
    };
  } catch {
    return {
      ok: false,
      injected: false,
      allowlisted: false,
      walletUrl: settings.walletUrl,
      preferOneshot: settings.preferOneshot,
      error: "Tab not found",
    };
  }
}

async function maybeAutoInject(tabId: number, url?: string): Promise<void> {
  if (!url) return;
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return;
  }
  const settings = await getSettings();
  if (!isOriginAllowlisted(origin, settings.allowlist)) return;

  const result = await injectProviderIntoTab(tabId);
  if (result.ok) {
    injectedTabs.add(tabId);
  }
}

export default defineBackground(() => {
  try {
    const chromeApi = (
      globalThis as unknown as {
        chrome?: {
          sidePanel?: {
            setPanelBehavior: (options: {
              openPanelOnActionClick: boolean;
            }) => Promise<void>;
          };
        };
      }
    ).chrome;
    void chromeApi?.sidePanel?.setPanelBehavior?.({
      openPanelOnActionClick: false,
    });
  } catch {
    // Firefox
  }

  browser.runtime.onConnect.addListener((port) => {
    if (port.name === "sidepanel") {
      attachSidepanelPort(port);
    }
  });

  browser.runtime.onMessage.addListener(
    (raw: ExtRuntimeMessage, sender, sendResponse) => {
      const respond = (value: unknown) => {
        sendResponse(value);
      };

      void (async () => {
        try {
          switch (raw.type) {
            case "get-status": {
              respond(await statusForTab(raw.tabId ?? sender.tab?.id));
              break;
            }
            case "open-wallet-ui": {
              await openWalletUi(raw.windowId);
              respond({ ok: true });
              break;
            }
            case "add-allowlist-origin": {
              await addAllowlistOrigin(raw.origin);
              respond({ ok: true });
              break;
            }
            case "inject-tab": {
              const result = await injectProviderIntoTab(raw.tabId);
              if (result.ok) injectedTabs.add(raw.tabId);
              respond(result);
              break;
            }
            case "eip1193-request": {
              const tabId = sender.tab?.id;
              if (typeof tabId !== "number" || tabId <= 0) {
                respond({
                  type: "eip1193-response",
                  tabId: -1,
                  id: raw.id,
                  error: {
                    code: -32603,
                    message:
                      "EIP-1193 request has no valid tab id (content script sender.tab missing)",
                  },
                } satisfies ExtEip1193ResponseMessage);
                break;
              }
              const message: ExtEip1193RoutedRequestMessage = {
                ...raw,
                tabId,
              };
              injectedTabs.add(tabId);
              console.info("[1Shot] eip1193-request", message.method, {
                tabId,
                id: message.id,
                hasPanel: Boolean(sidepanelPort),
              });
              const response = await handleEip1193Request(message);
              respond(response);
              break;
            }
            case "sidepanel-ready": {
              respond({ ok: true });
              break;
            }
            default:
              respond({ ok: false, error: "Unknown message" });
          }
        } catch (error) {
          respond({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();

      return true;
    },
  );

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
      void maybeAutoInject(tabId, tab.url);
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    injectedTabs.delete(tabId);
  });
});
