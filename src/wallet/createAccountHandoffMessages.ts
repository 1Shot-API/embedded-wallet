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
  credentialId?: string;
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

export function postAccountCreateHandoff(
  target: Window,
  message: AccountCreateHandoffMessage,
): void {
  target.postMessage(message, window.location.origin);
}

export function newCreateHandoffNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
