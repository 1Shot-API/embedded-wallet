import { usePasskeyPromptStore } from "../../wallet/passkeyPromptStore";
import { EPasskeyPromptReason } from "../../lib/types/enum/EPasskeyPromptReason";
import type { IStyleCopyPasskeyPrompt } from "../../style/types";
import { useStyle } from "../../style/StyleProvider";
import { Modal } from "../Modal";

function copyForReason(
  reason: EPasskeyPromptReason,
  prompts: IStyleCopyPasskeyPrompt,
): { title: string; body: string } {
  switch (reason) {
    case EPasskeyPromptReason.Unlock:
      return prompts.unlock;
    case EPasskeyPromptReason.Create:
      return prompts.create;
    case EPasskeyPromptReason.Sign:
      return prompts.sign;
    case EPasskeyPromptReason.Encrypt:
      return prompts.encrypt;
    case EPasskeyPromptReason.Decrypt:
      return prompts.decrypt;
    case EPasskeyPromptReason.RelayerAuth:
      return prompts.relayerAuth;
    case EPasskeyPromptReason.WalletUpgrade:
      return prompts.walletUpgrade;
    case EPasskeyPromptReason.ApproveTransaction:
      return prompts.approveTransaction;
    case EPasskeyPromptReason.AdjustFee:
      return prompts.adjustFee;
    case EPasskeyPromptReason.Backup:
      return prompts.backup;
  }
}

/**
 * Non-interactive Branding overlay for Branding-native WebAuthn only
 * (e.g. Relayer assertion). Signing Layer PRF uses Confirm UI in the signer.
 * Dismisses when {@link withPasskeyPrompt} finishes.
 */
export function PasskeyPromptModal() {
  const reason = usePasskeyPromptStore((state) => state.activeReason);
  const { style } = useStyle();

  if (!reason) {
    return null;
  }

  const copy = copyForReason(reason, style.copy.passkeyPrompt);

  return (
    <Modal title={copy.title} contentClassName="z-[10001]">
      <p className="m-0">{copy.body}</p>
    </Modal>
  );
}
