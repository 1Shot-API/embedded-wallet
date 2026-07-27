import {
  EWalletPresentationMode,
  OWSProxy,
} from "@1shotapi/ows-provider";
import { OwsUserRejectedError } from "@1shotapi/ows-types";
import {
  OWS_ACCOUNT_CREATED,
  OWS_ACCOUNT_CREATE_CANCELLED,
  OWS_ACCOUNT_CREATE_FAILED,
  postAccountCreateHandoff,
  type AccountCreateHandoffMessage,
} from "../src/wallet/createAccountHandoffMessages";

const WALLET_SIZE_X = 360;
const WALLET_SIZE_Y = 600;

const statusEl = document.getElementById("status")!;
const container = document.getElementById("wallet-container")!;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function readHandoff(): string | null {
  const value = new URLSearchParams(window.location.search).get("handoff");
  return value && value.length > 0 ? value : null;
}

function notifyOpener(message: AccountCreateHandoffMessage): void {
  if (!window.opener || window.opener.closed) {
    return;
  }
  postAccountCreateHandoff(window.opener, message);
}

function closeOrPrompt(): void {
  window.close();
  // Some browsers ignore window.close() for script-opened tabs after delay.
  setStatus(
    "You can close this tab and return to the app.",
    false,
  );
}

async function main(): Promise<void> {
  const handoff = readHandoff();
  if (!handoff) {
    setStatus("Missing handoff token. Open this page from the wallet.", true);
    return;
  }

  if (!window.opener) {
    setStatus(
      "This page must be opened from the wallet. Return to the app and try Create again.",
      true,
    );
    return;
  }

  const walletUrl = new URL("/", window.location.origin).href;
  setStatus("Connecting to wallet…");

  const proxy = await OWSProxy.create(container, walletUrl, {
    walletSizeX: WALLET_SIZE_X,
    walletSizeY: WALLET_SIZE_Y,
    presentationMode: EWalletPresentationMode.Inline,
  });

  try {
    proxy.showWallet();
    setStatus("Follow the prompts to create your passkey…");

    const result = (await proxy.rpc("createAccount")) as {
      ok?: boolean;
      credentialId?: string;
    };

    if (!result?.credentialId) {
      throw new Error("createAccount returned no credentialId");
    }

    notifyOpener({
      type: OWS_ACCOUNT_CREATED,
      handoff,
      credentialId: result.credentialId,
    });
    setStatus("Account created. Closing…");
    closeOrPrompt();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Account creation failed";
    const cancelled =
      error instanceof OwsUserRejectedError ||
      (error instanceof Error && error.name === "OwsUserRejectedError");

    notifyOpener({
      type: cancelled
        ? OWS_ACCOUNT_CREATE_CANCELLED
        : OWS_ACCOUNT_CREATE_FAILED,
      handoff,
      message,
    });
    setStatus(message, true);
    closeOrPrompt();
  } finally {
    proxy.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("[create] failed", error);
  const handoff = readHandoff();
  if (handoff) {
    notifyOpener({
      type: OWS_ACCOUNT_CREATE_FAILED,
      handoff,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  setStatus(
    error instanceof Error ? error.message : "Failed to start",
    true,
  );
});
