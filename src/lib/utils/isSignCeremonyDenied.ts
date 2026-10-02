import { OwsNotAllowedError, OwsSignDeniedError } from "@1shotapi/ows-types";

/**
 * Single source of truth for recoverable Signing Layer / passkey cancel
 * (Confirm UI deny, ceremonyCancelled, OS WebAuthn cancel). Used by Branding
 * modals and relayer send error handling.
 */
export function isSignCeremonyDenied(error: unknown): boolean {
  if (error instanceof OwsSignDeniedError || error instanceof OwsNotAllowedError) {
    return true;
  }
  if (!(error instanceof Error)) return false;
  return (
    error.name === "OwsSignDeniedError" ||
    error.name === "OwsNotAllowedError" ||
    error.message.includes("signDenied") ||
    error.message.includes("SignDenied") ||
    error.message.includes("NotAllowed") ||
    error.message.includes("not allowed") ||
    error.message.includes("ceremonyCancelled")
  );
}

/**
 * Whether host flyout should collapse after a relayer send error.
 * In-wallet flows pass `retainDisplayDuringSubmit: true` (never hide here).
 * Host sends hide on terminal failures and after successful passkey before
 * submit; signer cancel does not hide (Branding returns to confirm).
 */
export function shouldHideDisplayOnRelayerError(
  error: unknown,
  retainDisplayDuringSubmit: boolean | undefined,
): boolean {
  if (retainDisplayDuringSubmit) return false;
  if (isSignCeremonyDenied(error)) return false;
  return true;
}
