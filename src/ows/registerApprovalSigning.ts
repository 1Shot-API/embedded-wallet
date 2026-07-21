import { SignHelper } from "@1shotapi/ows-signer-utils";
import type {
  OWSSigner,
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignHelperChainRpc,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import type { EVMTransactionHash } from "@1shotapi/ows-types";

export type RegisterApprovalSigningOptions = {
  /**
   * Setup-only gate for signed actions: run onboarding when no credential
   * exists. With a known credential, skip unlock — the signing ceremony
   * authenticates. Pair with {@link onAuthenticated}.
   */
  ensureReady?: () => Promise<void>;
  /** Mark unlocked + refresh addresses after a successful signing ceremony. */
  onAuthenticated?: () => void | Promise<void>;
  chainRpc: SignHelperChainRpc;
  requestPersonalSignApproval: (
    request: PersonalSignApprovalRequest,
  ) => Promise<boolean>;
  requestSignTypedDataApproval: (
    request: SignTypedDataApprovalRequest,
  ) => Promise<boolean>;
  /**
   * Branding owns consent + prepare + sign + broadcast for eth_sendTransaction.
   */
  approveAndSignTransaction: (
    request: SendTransactionApprovalRequest,
  ) => Promise<EVMTransactionHash>;
};

/**
 * Build SignHelper handlers and register them on the wallet (pre-`start()`).
 */
export function registerApprovalSigning(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterApprovalSigningOptions,
): SignHelper {
  const helper = new SignHelper(signer, wallet, {
    ensureReady: options.ensureReady,
    onAuthenticated: options.onAuthenticated,
    getChainId: () => options.chainRpc.getChainId(),
    requestPersonalSignApproval: options.requestPersonalSignApproval,
    requestSignTypedDataApproval: options.requestSignTypedDataApproval,
    approveAndSignTransaction: options.approveAndSignTransaction,
  });

  for (const [method, handler] of Object.entries(helper.handlers)) {
    wallet.registerEip1193(method, handler);
  }

  return helper;
}
