import { CONTENT_SOURCE, INPAGE_SOURCE, PROTOCOL_VERSION } from "./constants";

/** EIP-1193 methods that require opening the side panel for user interaction. */
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
]);

export function isInteractiveMethod(method: string): boolean {
  return INTERACTIVE_METHODS.has(method);
}

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
  tabId: number;
  id: string;
  method: string;
  params?: unknown;
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
