import { SignHelper } from "@1shotapi/ows-signer-utils";
import type {
  OWSSigner,
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignHelperChainRpc,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import type { EVMSignatureHex, EVMTransactionHash } from "@1shotapi/ows-types";

export type RegisterApprovalSigningOptions = {
  /**
   * Setup-only gate before signed actions: run onboarding when no credential
   * exists. With a known credential, skip unlock — the signing ceremony
   * authenticates. Pair with {@link onAuthenticated}.
   */
  ensureReady?: () => Promise<void>;
  /** Mark unlocked + refresh addresses after a successful message/typed-data ceremony. */
  onAuthenticated?: () => void | Promise<void>;
  chainRpc: SignHelperChainRpc;
  /**
   * Branding owns consent UI + `signMessage`. Keep the view open until the
   * Signing Layer ceremony finishes.
   */
  approveAndSignPersonalMessage: (
    request: PersonalSignApprovalRequest,
  ) => Promise<EVMSignatureHex>;
  /**
   * Branding owns consent UI + `signTypedData`. Keep the view open until the
   * Signing Layer ceremony finishes.
   */
  approveAndSignTypedData: (
    request: SignTypedDataApprovalRequest,
  ) => Promise<EVMSignatureHex>;
  /**
   * Branding owns consent + prepare + sign + broadcast for eth_sendTransaction
   * (including any send-specific auth side effects).
   */
  approveAndSignTransaction: (
    request: SendTransactionApprovalRequest,
  ) => Promise<EVMTransactionHash>;
};

/**
 * Build SignHelper handlers and register them on the wallet (pre-`start()`).
 *
 * SignHelper only adapts EIP-1193 ↔ `approveAndSign*`. Setup / unlock live here
 * so branding owns the link to `OWSSigner`.
 */
export function registerApprovalSigning(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterApprovalSigningOptions,
): SignHelper {
  const helper = new SignHelper(signer, wallet, {
    getChainId: () => options.chainRpc.getChainId(),
    approveAndSignPersonalMessage: async (request) => {
      await options.ensureReady?.();
      const signature = await options.approveAndSignPersonalMessage(request);
      await options.onAuthenticated?.();
      return signature;
    },
    approveAndSignTypedData: async (request) => {
      await options.ensureReady?.();
      const signature = await options.approveAndSignTypedData(request);
      await options.onAuthenticated?.();
      return signature;
    },
    approveAndSignTransaction: async (request) => {
      await options.ensureReady?.();
      return options.approveAndSignTransaction(request);
    },
  });

  for (const [method, handler] of Object.entries(helper.handlers)) {
    wallet.registerEip1193(method, handler);
  }

  return helper;
}
