import type { HexString } from "@1shotapi/ows-types";
import type { DelegationId } from "../../types/primitives/DelegationId";
import type {
  IDelegationSummary,
  IStoredDelegation,
} from "../../types/domain/StoredDelegation";

/**
 * Branding-owned persistence for ERC-7715 / MetaMask delegations.
 * Plaintext at this boundary; encryption at rest is an implementation detail.
 */
export interface IDelegationRepository {
  storeDelegation(delegation: IStoredDelegation): Promise<void>;
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
}

export const IDelegationRepositoryType = Symbol.for("IDelegationRepository");
