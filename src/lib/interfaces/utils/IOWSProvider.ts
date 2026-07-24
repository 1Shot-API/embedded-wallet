import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";

/**
 * Lazy accessors for Branding Layer runtime objects (Signing Layer, wallet,
 * chain RPC helper). Getters resolve only after boot has called the matching
 * {@link setSigner} / {@link setWallet} / {@link setRpcHelper}.
 */
export interface IOWSProvider {
  getSigner(): Promise<OWSSigner>;
  getWallet(): Promise<OWSWallet>;
  getRpcHelper(): Promise<RpcHelper>;

  setSigner(signer: OWSSigner): void;
  setWallet(wallet: OWSWallet): void;
  setRpcHelper(rpcHelper: RpcHelper): void;

  /**
   * Re-show / focus the branding iframe before WebAuthn. Releases display depth
   * immediately so nested sessions do not block hide after SignHelper finishes.
   */
  ensureDisplay(): Promise<void>;

  /** Force-hide the branding flyout (e.g. after the last passkey ceremony). */
  hideDisplay(): Promise<void>;
}

export const IOWSProviderType = Symbol.for("IOWSProvider");
