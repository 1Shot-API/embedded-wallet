import { COSEPublicKey, CredentialId } from "@1shotapi/ows-types";

export const OWS_ACCOUNT_CREATED = "ows:accountCreated" as const;
export const OWS_ACCOUNT_CREATE_FAILED = "ows:accountCreateFailed" as const;
export const OWS_ACCOUNT_CREATE_CANCELLED =
  "ows:accountCreateCancelled" as const;

export type AccountCreateHandoffType =
  | typeof OWS_ACCOUNT_CREATED
  | typeof OWS_ACCOUNT_CREATE_FAILED
  | typeof OWS_ACCOUNT_CREATE_CANCELLED;

export type AccountCreateHandoffMessage = {
  type: AccountCreateHandoffType;
  handoff: string;
  credentialId?: CredentialId;
  /** COSE public key from attestation — needed for opener relayer register. */
  cosePublicKey?: COSEPublicKey;
  message?: string;
};

export function isAccountCreateHandoffMessage(
  value: unknown,
): value is AccountCreateHandoffMessage {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (record.type === OWS_ACCOUNT_CREATED ||
      record.type === OWS_ACCOUNT_CREATE_FAILED ||
      record.type === OWS_ACCOUNT_CREATE_CANCELLED) &&
    typeof record.handoff === "string"
  );
}

/**
 * Same-origin channel for `/create` → Branding handoff.
 *
 * Safari (and Chrome) extension sidebars often open a tab with
 * `window.opener === null`, so `postMessage` to the opener never runs.
 * Both documents are the wallet origin — the extension page is not in this
 * channel and does not need to be an allowed postMessage origin.
 */
const CREATE_HANDOFF_CHANNEL = "ows:account-create-handoff";

export function subscribeAccountCreateHandoff(
  listener: (message: AccountCreateHandoffMessage) => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") {
    return () => {};
  }
  const channel = new BroadcastChannel(CREATE_HANDOFF_CHANNEL);
  const onMessage = (event: MessageEvent) => {
    if (isAccountCreateHandoffMessage(event.data)) {
      listener(event.data);
    }
  };
  channel.addEventListener("message", onMessage);
  return () => {
    channel.removeEventListener("message", onMessage);
    channel.close();
  };
}

export function postAccountCreateHandoff(
  target: Window | null,
  message: AccountCreateHandoffMessage,
): void {
  if (target && !target.closed) {
    try {
      target.postMessage(message, window.location.origin);
    } catch {
      // Inaccessible opener (common when the tab was opened from an extension).
    }
  }
  if (typeof BroadcastChannel === "undefined") {
    return;
  }
  const channel = new BroadcastChannel(CREATE_HANDOFF_CHANNEL);
  channel.postMessage(message);
  channel.close();
}

export function newCreateHandoffNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
