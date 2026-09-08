import type { HexString, WebAuthnAssertionFields } from "@1shotapi/ows-types";
import type { DelegationId } from "../../types/primitives/DelegationId";
import type { ChallengeId } from "../../types/primitives/ChallengeId";
import type {
  IDelegationSummary,
  IStoredDelegation,
} from "../../types/domain/StoredDelegation";
import type { IWalletCredentialChallengeResponse } from "../../types/domain/RelayerCredentials";

/**
 * Branding-owned persistence for ERC-7715 / MetaMask delegations.
 * Plaintext at this boundary; encryption at rest is an implementation detail.
 */
export interface IDelegationRepository {
  storeDelegation(delegation: IStoredDelegation): Promise<void>;
  /** Persist multiple delegations; one encrypt + one multi-blob vault upload. */
  storeDelegations(delegations: IStoredDelegation[]): Promise<void>;
  getDelegation(
    delegationId: DelegationId,
  ): Promise<IStoredDelegation | undefined>;
  /**
   * Lookup by on-chain / kit delegation hash (for
   * `wallet_revokeExecutionPermission`).
   */
  getDelegationByHash(
    delegationHash: HexString,
  ): Promise<IStoredDelegation | undefined>;
  listDelegations(): Promise<IDelegationSummary[]>;
  deleteDelegation(delegationId: DelegationId): Promise<void>;

  /** Mint a single-use relayer challenge for batched vault auth. */
  mintRelayerVaultChallenge(): Promise<IWalletCredentialChallengeResponse>;

  /** Cache assertion from an `executeBatch` ceremony for a later vault HTTP call. */
  cacheRelayerVaultAssertion(
    challengeId: ChallengeId,
    assertion: WebAuthnAssertionFields,
  ): void;
}

export const IDelegationRepositoryType = Symbol.for("IDelegationRepository");
