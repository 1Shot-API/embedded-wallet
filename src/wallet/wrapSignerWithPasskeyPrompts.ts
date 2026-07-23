import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import { EPasskeyPromptReason } from "../lib/types/enum";
import { usePasskeyPromptStore } from "./passkeyPromptStore";
import { withPasskeyPrompt } from "./withPasskeyPrompt";

/**
 * Wrap Signing Layer ceremony methods so each WebAuthn prompt shows the
 * passkey explanation overlay. Chain namespaces (`evm` / `solana`) call
 * through these methods, so SignHelper and send paths are covered.
 */
export function wrapSignerWithPasskeyPrompts(signer: OWSSigner): OWSSigner {
  const createCredential = signer.createCredential.bind(signer);
  const getPublicKey = signer.getPublicKey.bind(signer);
  const signDigest = signer.signDigest.bind(signer);
  const encryptAES256 = signer.encryptAES256.bind(signer);
  const decryptAES256 = signer.decryptAES256.bind(signer);
  const createRecoveryData = signer.createRecoveryData.bind(signer);
  const revealPrivateKey = signer.revealPrivateKey.bind(signer);
  const recoverKey = signer.recoverKey.bind(signer);

  signer.createCredential = ((...args: Parameters<OWSSigner["createCredential"]>) =>
    withPasskeyPrompt(EPasskeyPromptReason.Create, () =>
      createCredential(...args),
    )) as OWSSigner["createCredential"];

  signer.getPublicKey = ((...args: Parameters<OWSSigner["getPublicKey"]>) =>
    withPasskeyPrompt(EPasskeyPromptReason.Unlock, () =>
      getPublicKey(...args),
    )) as OWSSigner["getPublicKey"];

  signer.signDigest = ((...args: Parameters<OWSSigner["signDigest"]>) => {
    // Keep an outer ceremony overlay (e.g. WalletUpgrade) visible — do not
    // replace it with the generic Sign copy for nested digest signing.
    if (usePasskeyPromptStore.getState().activeReason) {
      return signDigest(...args);
    }
    return withPasskeyPrompt(EPasskeyPromptReason.Sign, () =>
      signDigest(...args),
    );
  }) as OWSSigner["signDigest"];

  signer.encryptAES256 = ((...args: Parameters<OWSSigner["encryptAES256"]>) =>
    withPasskeyPrompt(EPasskeyPromptReason.Encrypt, () =>
      encryptAES256(...args),
    )) as OWSSigner["encryptAES256"];

  signer.decryptAES256 = ((...args: Parameters<OWSSigner["decryptAES256"]>) =>
    withPasskeyPrompt(EPasskeyPromptReason.Decrypt, () =>
      decryptAES256(...args),
    )) as OWSSigner["decryptAES256"];

  signer.createRecoveryData = ((
    ...args: Parameters<OWSSigner["createRecoveryData"]>
  ) =>
    withPasskeyPrompt(EPasskeyPromptReason.Backup, () =>
      createRecoveryData(...args),
    )) as OWSSigner["createRecoveryData"];

  signer.revealPrivateKey = ((
    ...args: Parameters<OWSSigner["revealPrivateKey"]>
  ) =>
    withPasskeyPrompt(EPasskeyPromptReason.Unlock, () =>
      revealPrivateKey(...args),
    )) as OWSSigner["revealPrivateKey"];

  signer.recoverKey = (async (
    ...args: Parameters<OWSSigner["recoverKey"]>
  ) => {
    const credentialId = args[3];
    if (credentialId) {
      return withPasskeyPrompt(EPasskeyPromptReason.Unlock, () =>
        recoverKey(...args),
      );
    }
    return recoverKey(...args);
  }) as OWSSigner["recoverKey"];

  return signer;
}
