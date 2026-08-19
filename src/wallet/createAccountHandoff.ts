import { COSEPublicKey, CredentialId, OwsUserRejectedError } from "@1shotapi/ows-types";
import { createAccountPageUrl } from "./passkeyCreateSupport";
import { pushModal } from "./pushModal";
import {
  isAccountCreateHandoffMessage,
  newCreateHandoffNonce,
  OWS_ACCOUNT_CREATED,
  OWS_ACCOUNT_CREATE_CANCELLED,
  subscribeAccountCreateHandoff,
  type AccountCreateHandoffMessage,
} from "./createAccountHandoffMessages";

export {
  OWS_ACCOUNT_CREATED,
  OWS_ACCOUNT_CREATE_CANCELLED,
  OWS_ACCOUNT_CREATE_FAILED,
  isAccountCreateHandoffMessage,
  newCreateHandoffNonce,
  postAccountCreateHandoff,
  type AccountCreateHandoffMessage,
  type AccountCreateHandoffType,
} from "./createAccountHandoffMessages";

const HANDOFF_TIMEOUT_MS = 10 * 60 * 1000;
/** After popup closes, wait for an in-flight success postMessage before rejecting. */
const POPUP_CLOSED_GRACE_MS = 1500;

export type IFirstPartyCreateResult = {
  credentialId: CredentialId;
  cosePublicKey: COSEPublicKey;
};

/**
 * Open first-party `/create` for WebAuthn registration only.
 * Opener finishes unlock + relayer register via {@link adoptCreatedCredential}.
 */
export async function createAccountViaFirstPartyTab(): Promise<IFirstPartyCreateResult> {
  const handoff = newCreateHandoffNonce();
  const url = createAccountPageUrl(handoff);

  console.info("[create-handoff] opening /create", {
    handoff,
    url,
    origin: window.location.origin,
  });

  return new Promise<IFirstPartyCreateResult>((resolve, reject) => {
    let settled = false;
    let popup: Window | null = null;
    let sawPopupOpen = false;
    let pollId: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let closedGraceId: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeBroadcast = () => {};

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      unsubscribeBroadcast();
      if (pollId !== undefined) clearInterval(pollId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (closedGraceId !== undefined) clearTimeout(closedGraceId);
    };

    const finishResolve = (result: IFirstPartyCreateResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      console.info("[create-handoff] resolved with credentialId", {
        handoff,
        credentialIdPrefix: result.credentialId.slice(0, 8),
        hasCosePublicKey: Boolean(result.cosePublicKey),
      });
      resolve(result);
    };

    const finishReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      console.warn("[create-handoff] rejected", { handoff, error });
      reject(error);
    };

    const handleHandoff = (
      data: AccountCreateHandoffMessage,
      meta: { via: "postMessage" | "broadcast"; sourceIsPopup?: boolean | string },
    ) => {
      console.info("[create-handoff] message received", {
        type: data.type,
        handoff: data.handoff,
        expectedHandoff: handoff,
        handoffMatch: data.handoff === handoff,
        via: meta.via,
        sourceIsPopup: meta.sourceIsPopup,
        hasCredentialId: Boolean(data.credentialId),
        hasCosePublicKey: Boolean(data.cosePublicKey),
      });

      if (data.handoff !== handoff) return;

      // Handoff nonce is authoritative. Do not require event.source === popup —
      // some browsers (notably after close) lose WindowProxy identity and would
      // drop a valid success message, leaving the opener on the login screen.

      if (data.type === OWS_ACCOUNT_CREATED) {
        if (!data.credentialId) {
          finishReject(new Error("Account created but credential id missing"));
          return;
        }
        if (!data.cosePublicKey) {
          finishReject(
            new Error(
              "Account created but authenticator public key missing — cannot register with relayer",
            ),
          );
          return;
        }
        finishResolve({
          credentialId: data.credentialId,
          cosePublicKey: data.cosePublicKey,
        });
        return;
      }
      if (data.type === OWS_ACCOUNT_CREATE_CANCELLED) {
        finishReject(
          new OwsUserRejectedError(
            data.message ?? "User cancelled passkey creation",
          ),
        );
        return;
      }
      finishReject(new Error(data.message ?? "Passkey creation failed"));
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (!isAccountCreateHandoffMessage(event.data)) {
        return;
      }
      handleHandoff(event.data, {
        via: "postMessage",
        sourceIsPopup: popup ? event.source === popup : "(no popup ref)",
      });
    };

    window.addEventListener("message", onMessage);
    unsubscribeBroadcast = subscribeAccountCreateHandoff((data) => {
      handleHandoff(data, { via: "broadcast" });
    });

    timeoutId = setTimeout(() => {
      finishReject(new Error("Passkey creation timed out"));
    }, HANDOFF_TIMEOUT_MS);

    pollId = setInterval(() => {
      if (!popup || settled) return;
      if (!popup.closed) {
        sawPopupOpen = true;
        return;
      }
      // Extension-opened tabs sometimes return a WindowProxy that is already
      // `.closed` while the real tab is open — only treat close after we saw open.
      if (!sawPopupOpen || closedGraceId !== undefined) return;

      console.info(
        "[create-handoff] popup closed; waiting for in-flight message",
        { handoff, graceMs: POPUP_CLOSED_GRACE_MS },
      );
      closedGraceId = setTimeout(() => {
        finishReject(
          new OwsUserRejectedError("Create account tab was closed"),
        );
      }, POPUP_CLOSED_GRACE_MS);
    }, 500);

    // Prefer keeping opener for postMessage; BroadcastChannel covers extension
    // sidebars that open the tab with window.opener === null.
    const openPopup = (): Window | null =>
      window.open(url, "ows-create-account");

    popup = openPopup();
    if (!popup) {
      void (async () => {
        try {
          const opened = await pushModal<boolean>(({ id, resolve: res }) => ({
            id,
            kind: "openCreateTab",
            createUrl: url,
            resolve: res,
          }));
          if (!opened) {
            finishReject(
              new OwsUserRejectedError("User cancelled opening create page"),
            );
            return;
          }
          popup = openPopup();
          if (!popup) {
            finishReject(
              new Error(
                "Pop-up blocked. Allow pop-ups for this site and try again.",
              ),
            );
          }
        } catch (error: unknown) {
          finishReject(error);
        }
      })();
    }
  });
}
