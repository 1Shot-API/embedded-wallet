import {
  EWalletPresentationMode,
  OWSProxy,
} from "@1shotapi/ows-provider";
import { type COSEPublicKey, type CredentialId, OwsUserRejectedError } from "@1shotapi/ows-types";


import {
  OWS_ACCOUNT_CREATED,
  OWS_ACCOUNT_CREATE_CANCELLED,
  OWS_ACCOUNT_CREATE_FAILED,
  postAccountCreateHandoff,
  type AccountCreateHandoffMessage,
} from "@/wallet/createAccountHandoffMessages";
import { appendCreateHostQuery } from "@/wallet/createHostEmbed";

import {
  CREATE_PAGE_VIEWPORT_CHROME,
  CREATE_WALLET_MOUNT_MIN_HEIGHT_PX,
  CREATE_WALLET_MOUNT_MIN_HEIGHT_VAR,
  CREATE_WALLET_SIZE_X_VAR,
  CREATE_WALLET_SIZE_Y_MAX_VAR,
  CREATE_WALLET_SIZE_Y_VAR,
  WALLET_SIZE_X,
  WALLET_SIZE_Y,
} from "./createHostConstants";

/**
 * First-party Host Layer page (same origin as the Branding Layer) for Safari
 * passkey create. That is why the wallet package depends on `@1shotapi/ows-provider`
 * — not for the Branding SPA itself. Integrator hosts use `host/` instead.
 *
 * Host-owned iframe panel size (branding scales to fit; see OWSProxy.create).
 */

/** Let postMessage reach the opener before window.close() races the poll. */
const CLOSE_AFTER_NOTIFY_MS = 400;

const statusEl = document.getElementById("status")!;
const mountEl = document.querySelector(".wallet-mount");
const container = document.getElementById("wallet-container")!;
const skeletonEl = document.getElementById("wallet-skeleton");

const CONNECTING_CLASS = "is-connecting";

function beginConnecting(): void {
  mountEl?.classList.add(CONNECTING_CLASS);
}

function endConnecting(): void {
  mountEl?.classList.remove(CONNECTING_CLASS);
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function applyMountSizeVars(): void {
  const root = document.documentElement;
  root.style.setProperty(CREATE_WALLET_SIZE_X_VAR, `${WALLET_SIZE_X}px`);
  root.style.setProperty(CREATE_WALLET_SIZE_Y_VAR, `${WALLET_SIZE_Y}px`);
  root.style.setProperty(
    CREATE_WALLET_SIZE_Y_MAX_VAR,
    `calc(100dvh - ${CREATE_PAGE_VIEWPORT_CHROME})`,
  );
  root.style.setProperty(
    CREATE_WALLET_MOUNT_MIN_HEIGHT_VAR,
    `${CREATE_WALLET_MOUNT_MIN_HEIGHT_PX}px`,
  );
}

applyMountSizeVars();

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
  statusEl.hidden = false;
}

function hideStatus(): void {
  statusEl.hidden = true;
  statusEl.textContent = "";
  statusEl.classList.remove("error");
}

function dismissSkeleton(): void {
  skeletonEl?.remove();
}

function abortCreatePage(message: string): void {
  endConnecting();
  dismissSkeleton();
  setStatus(message, true);
}

function readHandoff(): string | null {
  const value = new URLSearchParams(window.location.search).get("handoff");
  return value && value.length > 0 ? value : null;
}

function notifyWallet(message: AccountCreateHandoffMessage): void {
  const opener = window.opener as Window | null;
  const hasOpener = Boolean(opener) && !opener!.closed;
  console.info("[create] notify wallet", {
    type: message.type,
    handoff: message.handoff,
    hasOpener,
    credentialId: message.credentialId ? "(present)" : undefined,
    cosePublicKey: message.cosePublicKey ? "(present)" : undefined,
  });
  // Always BroadcastChannel (same-origin Branding iframe). Also postMessage
  // when opener exists — extension-opened tabs often have opener === null.
  postAccountCreateHandoff(hasOpener ? opener : null, message);
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
    abortCreatePage("Missing handoff token. Open this page from the wallet.");
    return;
  }

  const opener = window.opener as Window | null;
  const hasOpener = Boolean(opener) && !opener!.closed;
  console.info("[create] start", {
    handoff,
    origin: window.location.origin,
    hasOpener,
  });

  const walletUrl = appendCreateHostQuery(
    new URL("/", window.location.origin),
  ).href;
  beginConnecting();
  setStatus("Connecting to wallet…");

  const proxy = await OWSProxy.create(container, walletUrl, {
    walletSizeX: WALLET_SIZE_X,
    walletSizeY: WALLET_SIZE_Y,
    presentationMode: EWalletPresentationMode.Inline,
  });

  endConnecting();
  proxy.showWallet();
  await waitForNextPaint();
  dismissSkeleton();
  hideStatus();

  try {
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

    notifyWallet({
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

    notifyWallet({
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
  const message =
    error instanceof Error ? error.message : "Failed to start";
  const handoff = readHandoff();
  if (handoff) {
    notifyWallet({
      type: OWS_ACCOUNT_CREATE_FAILED,
      handoff,
      message,
    });
  }
  abortCreatePage(message);
});
