import { CONTENT_SOURCE, INPAGE_SOURCE, PROTOCOL_VERSION } from "./constants";

/**
 * EIP-1193 methods that require opening the side panel for user interaction,
 * including the EIP-7715 grant / revoke prompts.
 */
export const INTERACTIVE_METHODS = new Set([
  "eth_requestAccounts",
  "eth_sendTransaction",
  "eth_sendRawTransaction",
  "eth_sign",
  "eth_signTransaction",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "personal_sign",
  "wallet_requestPermissions",
  "wallet_addEthereumChain",
  "wallet_switchEthereumChain",
  "wallet_watchAsset",
  "wallet_requestExecutionPermissions",
  "wallet_revokeExecutionPermission",
]);

export function isInteractiveMethod(method: string): boolean {
  return INTERACTIVE_METHODS.has(method);
}

/** EIP-1193 methods that establish a per-origin connection to the wallet. */
export const CONNECT_METHODS = new Set([
  "eth_requestAccounts",
  "wallet_requestPermissions",
]);

export function isConnectMethod(method: string): boolean {
  return CONNECT_METHODS.has(method);
}

/**
 * Read methods whose result reveals the connected account or what it granted.
 * An origin that has not connected gets `[]` from these instead of data.
 */
export const CONNECTION_SCOPED_READ_METHODS = new Set([
  "eth_accounts",
  "wallet_getPermissions",
  "wallet_getGrantedExecutionPermissions",
]);

export function isConnectionScopedRead(method: string): boolean {
  return CONNECTION_SCOPED_READ_METHODS.has(method);
}

/**
 * Interactive methods that may only run for an origin the user has connected.
 * Everything in {@link INTERACTIVE_METHODS} except the connect methods, so an
 * allowlisted-but-unconnected tab cannot raise prompts in the shared panel.
 */
export function requiresConnectedOrigin(method: string): boolean {
  return INTERACTIVE_METHODS.has(method) && !CONNECT_METHODS.has(method);
}

/**
 * Methods the wallet must attribute to the requesting page: every prompt and
 * every connection-scoped read. The side panel runs these one at a time and
 * forwards them through the wallet's `forwardEip1193` RPC with the origin, so
 * the wallet's consent UI, analytics, and grant scoping name the page rather
 * than the extension. Anything else (chain reads) goes straight through.
 */
export function isOriginBoundMethod(method: string): boolean {
  return (
    INTERACTIVE_METHODS.has(method) || CONNECTION_SCOPED_READ_METHODS.has(method)
  );
}

/**
 * Branding Layer custom RPC that runs an EIP-1193 method as a given page
 * origin. Only honored when the wallet's embedder is an extension page; see
 * `src/wallet/registerForwardEip1193.ts` in the wallet.
 */
export const WALLET_FORWARD_EIP1193_RPC_METHOD = "forwardEip1193";

// --- Page ↔ content (window.postMessage) ---

export type InpageToContentRequest = {
  source: typeof INPAGE_SOURCE;
  version: typeof PROTOCOL_VERSION;
  type: "request";
  id: string;
  method: string;
  params?: unknown;
};

export type InpageToContentReady = {
  source: typeof INPAGE_SOURCE;
  version: typeof PROTOCOL_VERSION;
  type: "ready";
};

export type ContentToInpageResponse = {
  source: typeof CONTENT_SOURCE;
  version: typeof PROTOCOL_VERSION;
  type: "response";
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type ContentToInpageEvent = {
  source: typeof CONTENT_SOURCE;
  version: typeof PROTOCOL_VERSION;
  type: "event";
  event: string;
  params: unknown[];
};

export type ContentToInpageConfig = {
  source: typeof CONTENT_SOURCE;
  version: typeof PROTOCOL_VERSION;
  type: "config";
  preferOneshot: boolean;
  iconUrl: string;
};

export function isInpageMessage(
  data: unknown,
): data is InpageToContentRequest | InpageToContentReady {
  if (!data || typeof data !== "object") return false;
  const msg = data as Partial<InpageToContentRequest>;
  return (
    msg.source === INPAGE_SOURCE &&
    msg.version === PROTOCOL_VERSION &&
    (msg.type === "request" || msg.type === "ready")
  );
}

export function isContentMessage(
  data: unknown,
): data is ContentToInpageResponse | ContentToInpageEvent | ContentToInpageConfig {
  if (!data || typeof data !== "object") return false;
  const msg = data as Partial<ContentToInpageResponse>;
  return (
    msg.source === CONTENT_SOURCE &&
    msg.version === PROTOCOL_VERSION &&
    (msg.type === "response" || msg.type === "event" || msg.type === "config")
  );
}

// --- Extension runtime messages ---

export type ExtInjectTabMessage = {
  type: "inject-tab";
  tabId: number;
};

export type ExtOpenWalletUiMessage = {
  type: "open-wallet-ui";
  windowId?: number;
};

export type ExtAddAllowlistOriginMessage = {
  type: "add-allowlist-origin";
  origin: string;
};

export type ExtGetStatusMessage = {
  type: "get-status";
  tabId?: number;
};

export type ExtEip1193RequestMessage = {
  type: "eip1193-request";
  /**
   * Optional from content scripts — background fills from `sender.tab.id`.
   * Never send `0` (not a valid WebExtensions tab id).
   */
  tabId?: number;
  id: string;
  method: string;
  params?: unknown;
};

/** EIP-1193 request after background has bound a real tab id and sender origin. */
export type ExtEip1193RoutedRequestMessage = ExtEip1193RequestMessage & {
  tabId: number;
  /** Browser-attested origin of the requesting page (`https://host[:port]`). */
  origin: string;
  /** Connect request from an origin not yet connected — side panel asks the user first. */
  requiresConsent: boolean;
};

export type ExtEip1193ResponseMessage = {
  type: "eip1193-response";
  tabId: number;
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type ExtEip1193EventMessage = {
  type: "eip1193-event";
  event: string;
  params: unknown[];
};

export type ExtSidepanelReadyMessage = {
  type: "sidepanel-ready";
};

export type ExtStatusResponse = {
  ok: boolean;
  injected: boolean;
  origin?: string;
  allowlisted: boolean;
  /** User approved a connect request from this tab's origin in this session. */
  connected: boolean;
  walletUrl: string;
  preferOneshot: boolean;
  error?: string;
};

export type ExtRuntimeMessage =
  | ExtInjectTabMessage
  | ExtOpenWalletUiMessage
  | ExtAddAllowlistOriginMessage
  | ExtGetStatusMessage
  | ExtEip1193RequestMessage
  | ExtEip1193ResponseMessage
  | ExtEip1193EventMessage
  | ExtSidepanelReadyMessage;
