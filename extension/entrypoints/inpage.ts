import {
  CONTENT_SOURCE,
  INPAGE_SOURCE,
  PROTOCOL_VERSION,
  PROVIDER_ICON_DATA_URI,
  PROVIDER_INFO,
} from "../src/shared/constants";
import {
  isContentMessage,
  type ContentToInpageConfig,
  type InpageToContentRequest,
} from "../src/shared/protocol";

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    __ONESHOT_OWS_INJECTED__?: boolean;
  }
}

type EthereumProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
  providers?: EthereumProvider[];
  is1Shot?: boolean;
  isMetaMask?: boolean;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const pending = new Map<string, Pending>();
const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

let preferOneshot = false;
let iconUrl = "";
let announced = false;
let installedProvider: EthereumProvider | null = null;

function nextId(): string {
  return crypto.randomUUID();
}

function postToContent(
  message: InpageToContentRequest | { source: typeof INPAGE_SOURCE; version: typeof PROTOCOL_VERSION; type: "ready" },
): void {
  window.postMessage(message, "*");
}

function emit(event: string, ...params: unknown[]): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(...params);
    } catch {
      // Host listener errors must not break the provider.
    }
  }
}

function createProvider(): EthereumProvider {
  const provider: EthereumProvider = {
    is1Shot: true,
    isMetaMask: false,
    request({ method, params }) {
      const id = nextId();
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        postToContent({
          source: INPAGE_SOURCE,
          version: PROTOCOL_VERSION,
          type: "request",
          id,
          method,
          params,
        });
      });
    },
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener);
    },
    removeListener(event, listener) {
      listeners.get(event)?.delete(listener);
    },
  };
  return provider;
}

function installWindowEthereum(provider: EthereumProvider): void {
  const existing = window.ethereum;
  if (!existing) {
    window.ethereum = provider;
    return;
  }
  if (preferOneshot) {
    const providers = existing.providers ? [...existing.providers] : [existing];
    if (!providers.includes(provider)) {
      providers.unshift(provider);
    }
    provider.providers = providers;
    window.ethereum = provider;
    return;
  }
  // Coexist via providers[] (EIP-1193 multi-injected wallet discovery).
  if (Array.isArray(existing.providers)) {
    if (!existing.providers.includes(provider)) {
      existing.providers.push(provider);
    }
    return;
  }
  // Wallet present but no providers[] — create one so 1Shot is still reachable
  // when MetaMask (or similar) is installed without exposing the array.
  try {
    existing.providers = [existing, provider];
  } catch {
    // Some providers freeze/seal window.ethereum; EIP-6963 still announces us.
  }
}

function announceEip6963(provider: EthereumProvider): void {
  if (announced) return;
  announced = true;

  const info = {
    uuid: PROVIDER_INFO.uuid,
    name: PROVIDER_INFO.name,
    icon: iconUrl || PROVIDER_ICON_DATA_URI,
    rdns: PROVIDER_INFO.rdns,
  };

  const announce = () => {
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: Object.freeze({ info, provider }),
      }),
    );
  };

  announce();
  window.addEventListener("eip6963:requestProvider", announce);
}

function applyConfig(config: ContentToInpageConfig): void {
  preferOneshot = config.preferOneshot;
  iconUrl = config.iconUrl;
  if (!installedProvider) {
    installedProvider = createProvider();
    installWindowEthereum(installedProvider);
    announceEip6963(installedProvider);
    return;
  }
  // Content sends config on startup and again on inpage `ready`. Reuse the
  // same provider so `window.ethereum.providers` and EIP-6963 stay single-entry.
  if (preferOneshot && window.ethereum !== installedProvider) {
    installWindowEthereum(installedProvider);
  }
}

function onMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  if (!isContentMessage(event.data)) return;

  if (event.data.type === "config") {
    applyConfig(event.data);
    return;
  }

  if (event.data.type === "response") {
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    if (event.data.error) {
      const err = new Error(event.data.error.message) as Error & {
        code?: number;
        data?: unknown;
      };
      err.code = event.data.error.code;
      err.data = event.data.error.data;
      entry.reject(err);
    } else {
      entry.resolve(event.data.result);
    }
    return;
  }

  if (event.data.type === "event") {
    emit(event.data.event, ...event.data.params);
  }
}

export default defineUnlistedScript(() => {
  if (window.__ONESHOT_OWS_INJECTED__) {
    return;
  }
  window.__ONESHOT_OWS_INJECTED__ = true;

  window.addEventListener("message", onMessage);
  postToContent({
    source: INPAGE_SOURCE,
    version: PROTOCOL_VERSION,
    type: "ready",
  });
});
