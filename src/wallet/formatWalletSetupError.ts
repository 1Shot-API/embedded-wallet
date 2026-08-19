/**
 * Map passkey login/create failures to host-overridable `style.copy.walletSetup` strings.
 */
export function formatWalletSetupError(
  error: unknown,
  copy: {
    passkeyTimeoutError: string;
    passkeyFailedError: string;
  },
): string {
  if (!(error instanceof Error)) {
    return copy.passkeyFailedError;
  }
  const name = error.name;
  const message = error.message;
  if (
    name === "OwsTimeoutError" ||
    message.includes("timed out") ||
    message.includes("Signer RPC timed out")
  ) {
    return copy.passkeyTimeoutError;
  }
  // User dismissed the signer Confirm UI or OS passkey sheet — soft message.
  if (
    name === "OwsSignDeniedError" ||
    name === "OwsNotAllowedError" ||
    message.includes("signDenied") ||
    message.includes("NotAllowed") ||
    message.includes("ceremonyCancelled")
  ) {
    return copy.passkeyFailedError;
  }
  return copy.passkeyFailedError;
}
