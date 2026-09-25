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
   * Readiness gate before signed actions. Prefer `ensureOnboardedForSigning`:
   * no-op when the session is already unlocked; otherwise full unlock/setup
   * so host-driven SIWE (`personal_sign` / typed data) does not fail while
   * locked. Pair with {@link onAuthenticated}.
   */
  ensureReady?: () => Promise<void>;
  /** Mark unlocked + refresh addresses after a successful signing ceremony. */
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
 * SignHelper adapts EIP-1193 ↔ `approveAndSign*`. Readiness (`ensureReady`) runs
 * inside approve callbacks (while the display session is held). Unlock
 * (`onAuthenticated`) is passed through to SignHelper so it runs after
 * display release — post-sign address refresh must not keep the flyout open.
 */
export function registerApprovalSigning(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterApprovalSigningOptions,
): SignHelper {
  const helper = new SignHelper(signer, wallet, {
    getChainId: () => options.chainRpc.getChainId(),
    // Runs after SignHelper releases the display session so address refresh
    // cannot keep the flyout open after consent/passkey finishes.
    onAuthenticated: options.onAuthenticated,
    approveAndSignPersonalMessage: async (request) => {
      await options.ensureReady?.();
      return options.approveAndSignPersonalMessage(request);
    },
    approveAndSignTypedData: async (request) => {
      await options.ensureReady?.();
      return options.approveAndSignTypedData(request);
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
