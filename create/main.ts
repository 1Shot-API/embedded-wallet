import {
  EWalletPresentationMode,
  OWSProxy,
} from "@1shotapi/ows-provider";
import { COSEPublicKey, CredentialId, OwsUserRejectedError } from "@1shotapi/ows-types";
import {
  OWS_ACCOUNT_CREATED,
  OWS_ACCOUNT_CREATE_CANCELLED,
  OWS_ACCOUNT_CREATE_FAILED,
  postAccountCreateHandoff,
  type AccountCreateHandoffMessage,
} from "../src/wallet/createAccountHandoffMessages";

/** Match branding `displayModalSize` (ConfigProvider default). */
const WALLET_SIZE_X = 420;
const WALLET_SIZE_Y = 480;

/** Let postMessage reach the opener before window.close() races the poll. */
const CLOSE_AFTER_NOTIFY_MS = 400;

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
  const opener = window.opener;
  if (!opener || opener.closed) {
    console.warn("[create] cannot notify opener", {
      hasOpener: Boolean(opener),
      closed: opener?.closed,
      type: message.type,
    });
    return;
  }
  console.info("[create] postMessage → opener", {
    type: message.type,
    handoff: message.handoff,
    credentialId: message.credentialId ? "(present)" : undefined,
    cosePublicKey: message.cosePublicKey ? "(present)" : undefined,
    targetOrigin: window.location.origin,
  });
  postAccountCreateHandoff(opener, message);
}

async function closeOrPrompt(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, CLOSE_AFTER_NOTIFY_MS));
  window.close();
  // Some browsers ignore window.close() for script-opened tabs after delay.
  setStatus("You can close this tab and return to the app.", false);
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

  console.info("[create] start", {
    handoff,
    origin: window.location.origin,
    hasOpener: true,
  });

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

    const result = (await proxy.rpc("createAccount", {
      registrationOnly: true,
    })) as {
      ok?: boolean;
      credentialId?: CredentialId;
      cosePublicKey?: COSEPublicKey;
    };

    if (!result?.credentialId) {
      throw new Error("createAccount returned no credentialId");
    }
    if (!result.cosePublicKey) {
      throw new Error(
        "createAccount returned no cosePublicKey — cannot finish on opener",
      );
    }

    console.info("[create] createAccount ok", {
      credentialIdPrefix: result.credentialId.slice(0, 8),
      hasCosePublicKey: true,
    });

    notifyOpener({
      type: OWS_ACCOUNT_CREATED,
      handoff,
      credentialId: result.credentialId,
      cosePublicKey: result.cosePublicKey,
    });
    setStatus("Account created. Closing…");
    await closeOrPrompt();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Account creation failed";
    const cancelled =
      error instanceof OwsUserRejectedError ||
      (error instanceof Error && error.name === "OwsUserRejectedError");

    console.warn("[create] createAccount failed", { cancelled, message, error });

    notifyOpener({
      type: cancelled
        ? OWS_ACCOUNT_CREATE_CANCELLED
        : OWS_ACCOUNT_CREATE_FAILED,
      handoff,
      message,
    });
    setStatus(message, true);
    await closeOrPrompt();
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
