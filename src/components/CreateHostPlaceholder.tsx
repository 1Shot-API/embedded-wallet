import { useStyle } from "../style/StyleProvider";
import { useWalletSessionStore } from "../wallet/sessionStore";

const FALLBACK_TITLE = "Name your passkey";
const FALLBACK_BODY =
  "Choose a name for this wallet passkey. Your device will use it when you create the credential and when you sign in later.";

/**
 * Stable shell for first-party `/create/` iframe embed — avoids flashing
 * login/create onboarding before `createAccount` opens PasskeyNameModal.
 */
export function CreateHostPlaceholder() {
  const ready = useWalletSessionStore((state) => state.ready);
  const { style } = useStyle();
  const title = ready ? style.copy.passkeyName.title : FALLBACK_TITLE;
  const body = ready ? style.copy.passkeyName.body : FALLBACK_BODY;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col px-5 pt-5"
      aria-busy={!ready}
      aria-label={title}
    >
      <h2 className="m-0 shrink-0 text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-muted-foreground mt-3 text-[0.95rem] leading-snug">
        {body}
      </p>

      <div className="mt-5 grid gap-1.5" aria-hidden="true">
        <div className="bg-muted h-4 w-24 rounded" />
        <div className="bg-muted h-10 w-full rounded-md" />
      </div>

      <div className="bg-muted mt-4 h-4 w-3/4 max-w-[16rem] rounded" aria-hidden />

      <div className="mt-auto flex flex-col-reverse gap-2 px-0 py-4">
        <div className="bg-muted h-11 w-full rounded-md" aria-hidden />
        <div className="bg-muted/70 h-11 w-full rounded-md" aria-hidden />
      </div>
    </div>
  );
}
