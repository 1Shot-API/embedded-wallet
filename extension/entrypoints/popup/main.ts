import { queryActiveDappTab } from "../../src/shared/activeTab";
import type {
  ExtRuntimeMessage,
  ExtStatusResponse,
} from "../../src/shared/protocol";

const originLine = document.getElementById("origin-line")!;
const statusEl = document.getElementById("status")!;
const injectBtn = document.getElementById("inject-btn") as HTMLButtonElement;
const allowlistBtn = document.getElementById(
  "allowlist-btn",
) as HTMLButtonElement;
const openWalletBtn = document.getElementById(
  "open-wallet-btn",
) as HTMLButtonElement;
const optionsLink = document.getElementById("options-link") as HTMLAnchorElement;

let activeTabId: number | undefined;
let activeOrigin: string | undefined;

function setStatus(message: string, kind: "ok" | "error" | "" = ""): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", kind === "error");
  statusEl.classList.toggle("ok", kind === "ok");
}

async function refresh(): Promise<void> {
  const tab = await queryActiveDappTab();
  activeTabId = tab?.id;
  try {
    activeOrigin = tab?.url ? new URL(tab.url).origin : undefined;
  } catch {
    activeOrigin = undefined;
  }
  originLine.textContent = activeOrigin ?? "Unsupported page";

  const status = (await browser.runtime.sendMessage({
    type: "get-status",
    tabId: activeTabId,
  } satisfies ExtRuntimeMessage)) as ExtStatusResponse;

  if (!status?.ok) {
    setStatus(status?.error ?? "Status unavailable", "error");
    return;
  }

  const bits = [
    status.injected ? "Provider injected" : "Not injected",
    status.allowlisted ? "allowlisted" : null,
  ].filter(Boolean);
  setStatus(bits.join(" · "));
  allowlistBtn.disabled = !activeOrigin;
  injectBtn.disabled = activeTabId == null;
}

injectBtn.addEventListener("click", () => {
  void (async () => {
    if (activeTabId == null) return;
    setStatus("Injecting…");
    const result = (await browser.runtime.sendMessage({
      type: "inject-tab",
      tabId: activeTabId,
    } satisfies ExtRuntimeMessage)) as { ok: boolean; error?: string };
    if (!result.ok) {
      setStatus(result.error ?? "Inject failed", "error");
      return;
    }
    setStatus("Provider injected", "ok");
    await refresh();
  })();
});

allowlistBtn.addEventListener("click", () => {
  void (async () => {
    if (!activeOrigin || activeTabId == null) return;
    await browser.runtime.sendMessage({
      type: "add-allowlist-origin",
      origin: activeOrigin,
    } satisfies ExtRuntimeMessage);
    const result = (await browser.runtime.sendMessage({
      type: "inject-tab",
      tabId: activeTabId,
    } satisfies ExtRuntimeMessage)) as { ok: boolean; error?: string };
    if (!result.ok) {
      setStatus(result.error ?? "Allowlisted but inject failed", "error");
      return;
    }
    setStatus(`Always inject on ${activeOrigin}`, "ok");
    await refresh();
  })();
});

openWalletBtn.addEventListener("click", () => {
  void (async () => {
    const win = await browser.windows.getCurrent();
    await browser.runtime.sendMessage({
      type: "open-wallet-ui",
      windowId: win.id,
    } satisfies ExtRuntimeMessage);
  })();
});

optionsLink.href = browser.runtime.getURL("/options.html");
optionsLink.addEventListener("click", (event) => {
  event.preventDefault();
  void browser.runtime.openOptionsPage();
});

void refresh();
