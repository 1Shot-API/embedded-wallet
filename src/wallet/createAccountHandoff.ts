import { OwsUserRejectedError } from "@1shotapi/ows-types";
import { createAccountPageUrl } from "./passkeyCreateSupport";
import { pushModal } from "./pushModal";
import {
  isAccountCreateHandoffMessage,
  newCreateHandoffNonce,
  OWS_ACCOUNT_CREATED,
  OWS_ACCOUNT_CREATE_CANCELLED,
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

/**
 * Open first-party `/create` and wait for credentialId via opener postMessage.
 * Relayer registration happens inside `/create`; opener only persists + unlocks.
 */
export async function createAccountViaFirstPartyTab(): Promise<string> {
  const handoff = newCreateHandoffNonce();
  const url = createAccountPageUrl(handoff);

  console.info("[create-handoff] opening /create", {
    handoff,
    url,
    origin: window.location.origin,
  });

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let popup: Window | null = null;
    let pollId: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let closedGraceId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (pollId !== undefined) clearInterval(pollId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (closedGraceId !== undefined) clearTimeout(closedGraceId);
    };

    const finishResolve = (credentialId: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      console.info("[create-handoff] resolved with credentialId", {
        handoff,
        credentialIdPrefix: credentialId.slice(0, 8),
      });
      resolve(credentialId);
    };

    const finishReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      console.warn("[create-handoff] rejected", { handoff, error });
      reject(error);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (!isAccountCreateHandoffMessage(event.data)) {
        return;
      }

      console.info("[create-handoff] message received", {
        type: event.data.type,
        handoff: event.data.handoff,
        expectedHandoff: handoff,
        handoffMatch: event.data.handoff === handoff,
        sourceIsPopup: popup ? event.source === popup : "(no popup ref)",
        hasCredentialId: Boolean(event.data.credentialId),
      });

      if (event.data.handoff !== handoff) return;

      // Handoff nonce is authoritative. Do not require event.source === popup —
      // some browsers (notably after close) lose WindowProxy identity and would
      // drop a valid success message, leaving the opener on the login screen.

      if (event.data.type === OWS_ACCOUNT_CREATED) {
        if (!event.data.credentialId) {
          finishReject(new Error("Account created but credential id missing"));
          return;
        }
        finishResolve(event.data.credentialId);
        return;
      }
      if (event.data.type === OWS_ACCOUNT_CREATE_CANCELLED) {
        finishReject(
          new OwsUserRejectedError(
            event.data.message ?? "User cancelled passkey creation",
          ),
        );
        return;
      }
      finishReject(
        new Error(event.data.message ?? "Passkey creation failed"),
      );
    };

    window.addEventListener("message", onMessage);

    timeoutId = setTimeout(() => {
      finishReject(new Error("Passkey creation timed out"));
    }, HANDOFF_TIMEOUT_MS);

    pollId = setInterval(() => {
      if (!popup || !popup.closed || settled) return;
      if (closedGraceId !== undefined) return;

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

    // Do not pass noopener/noreferrer — we need window.opener in /create.
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
