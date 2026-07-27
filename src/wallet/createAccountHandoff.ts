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

/**
 * Open first-party `/create` and wait for credentialId via opener postMessage.
 * Relayer registration happens inside `/create`; opener only persists + unlocks.
 */
export async function createAccountViaFirstPartyTab(): Promise<string> {
  const handoff = newCreateHandoffNonce();
  const url = createAccountPageUrl(handoff);

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let popup: Window | null = null;
    let pollId: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (pollId !== undefined) clearInterval(pollId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };

    const finishResolve = (credentialId: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(credentialId);
    };

    const finishReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (popup && event.source && event.source !== popup) return;
      if (!isAccountCreateHandoffMessage(event.data)) return;
      if (event.data.handoff !== handoff) return;

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
      if (popup && popup.closed) {
        finishReject(
          new OwsUserRejectedError("Create account tab was closed"),
        );
      }
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
