import type { CeremonyUiParams } from "@1shotapi/ows-types";
import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import { styleController } from "../style/styleController";
import type { IStyleCopyPasskeyPromptEntry } from "../style/types";
import { EPasskeyPromptReason } from "../lib/types/enum/EPasskeyPromptReason";
import { useCeremonyUiOverrideStore } from "./ceremonyUiOverrideStore";

function ceremonyFromEntry(
  entry: IStyleCopyPasskeyPromptEntry,
): CeremonyUiParams {
  return {
    explanationHeader: entry.title,
    explanationText: entry.body,
  };
}

function promptCopy(reason: EPasskeyPromptReason): CeremonyUiParams {
  const prompts = styleController.get().copy.passkeyPrompt;
  switch (reason) {
    case EPasskeyPromptReason.Create:
      return ceremonyFromEntry(prompts.create);
    case EPasskeyPromptReason.Unlock:
      return ceremonyFromEntry(prompts.unlock);
    case EPasskeyPromptReason.Sign:
      return ceremonyFromEntry(prompts.sign);
    case EPasskeyPromptReason.Encrypt:
      return ceremonyFromEntry(prompts.encrypt);
    case EPasskeyPromptReason.Decrypt:
      return ceremonyFromEntry(prompts.decrypt);
    case EPasskeyPromptReason.Backup:
      return ceremonyFromEntry(prompts.backup);
    case EPasskeyPromptReason.WalletUpgrade:
      return ceremonyFromEntry(prompts.walletUpgrade);
    case EPasskeyPromptReason.ApproveTransaction:
      return ceremonyFromEntry(prompts.approveTransaction);
    case EPasskeyPromptReason.AdjustFee:
      return ceremonyFromEntry(prompts.adjustFee);
    case EPasskeyPromptReason.RelayerAuth:
      return ceremonyFromEntry(prompts.relayerAuth);
    default:
      return ceremonyFromEntry(prompts.sign);
  }
}

function mergeCeremony(
  reason: EPasskeyPromptReason,
  options?: CeremonyUiParams & { credentialId?: string },
): CeremonyUiParams & { credentialId?: string } {
  const override = useCeremonyUiOverrideStore.getState().reason;
  const base = promptCopy(override ?? reason);
  return {
    ...base,
    ...options,
    explanationHeader: options?.explanationHeader ?? base.explanationHeader,
    explanationText: options?.explanationText ?? base.explanationText,
    confirmButtonText: options?.confirmButtonText ?? base.confirmButtonText,
    denyButtonText: options?.denyButtonText ?? base.denyButtonText,
  };
}

/**
 * Inject Signing Layer ceremony Confirm copy from `style.copy.passkeyPrompt`.
 * Passkey Confirm UI lives in the signer iframe — Branding no longer overlays
 * these PRF paths. Relayer Branding-native WebAuthn still uses
 * {@link withPasskeyPrompt}.
 */
export function wrapSignerWithCeremonyCopy(signer: OWSSigner): OWSSigner {
  const createCredential = signer.createCredential.bind(signer);
  const getPublicKey = signer.getPublicKey.bind(signer);
  const signDigest = signer.signDigest.bind(signer);
  const executeBatch = signer.executeBatch.bind(signer);
  const encryptAES256 = signer.encryptAES256.bind(signer);
  const decryptAES256 = signer.decryptAES256.bind(signer);
  const createRecoveryData = signer.createRecoveryData.bind(signer);
  const revealPrivateKey = signer.revealPrivateKey.bind(signer);
  const recoverKey = signer.recoverKey.bind(signer);

  signer.createCredential = ((name, options) =>
    createCredential(name, mergeCeremony(EPasskeyPromptReason.Create, options))) as OWSSigner["createCredential"];

  signer.getPublicKey = ((params) =>
    getPublicKey(mergeCeremony(EPasskeyPromptReason.Unlock, params))) as OWSSigner["getPublicKey"];

  signer.signDigest = ((digests, options) =>
    signDigest(
      digests,
      mergeCeremony(EPasskeyPromptReason.Sign, options),
    )) as OWSSigner["signDigest"];

  signer.executeBatch = ((params) =>
    executeBatch(
      mergeCeremony(EPasskeyPromptReason.Sign, params),
    )) as OWSSigner["executeBatch"];

  signer.encryptAES256 = ((plaintexts, options) =>
    encryptAES256(
      plaintexts,
      mergeCeremony(EPasskeyPromptReason.Encrypt, options),
    )) as OWSSigner["encryptAES256"];

  signer.decryptAES256 = ((ciphertexts, options) =>
    decryptAES256(
      ciphertexts,
      mergeCeremony(EPasskeyPromptReason.Decrypt, options),
    )) as OWSSigner["decryptAES256"];

  signer.createRecoveryData = ((
    passwordText,
    buttonText,
    minPasswordLength,
    options,
  ) =>
    createRecoveryData(
      passwordText,
      buttonText,
      minPasswordLength,
      mergeCeremony(EPasskeyPromptReason.Backup, options),
    )) as OWSSigner["createRecoveryData"];

  signer.revealPrivateKey = ((options) =>
    revealPrivateKey(
      mergeCeremony(EPasskeyPromptReason.Unlock, options),
    )) as OWSSigner["revealPrivateKey"];

  signer.recoverKey = ((envelope, passwordText, buttonText, options) =>
    recoverKey(
      envelope,
      passwordText,
      buttonText,
      mergeCeremony(
        options?.credentialId
          ? EPasskeyPromptReason.Unlock
          : EPasskeyPromptReason.Backup,
        options,
      ),
    )) as OWSSigner["recoverKey"];

  return signer;
}
