import type { EPasskeyPromptReason } from "../lib/types/enum";
import { usePasskeyPromptStore } from "./passkeyPromptStore";

/**
 * Show the passkey explanation overlay for {@link reason} while {@link run}
 * executes (typically a WebAuthn ceremony). Always dismisses in `finally`.
 */
export async function withPasskeyPrompt<T>(
  reason: EPasskeyPromptReason,
  run: () => Promise<T>,
): Promise<T> {
  const id = usePasskeyPromptStore.getState().show(reason);
  try {
    return await run();
  } finally {
    usePasskeyPromptStore.getState().hide(id);
  }
}
