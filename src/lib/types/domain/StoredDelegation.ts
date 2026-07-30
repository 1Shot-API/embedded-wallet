import type {
  DomainString,
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  HexString,
  IExecutionPermissionResponse,
  UnixTimestamp,
} from "@1shotapi/ows-types";
import type { DelegationId } from "../primitives/DelegationId";

/** One MetaMask Delegation Framework caveat (enforcer + terms + args). */
export interface IDelegationCaveat {
  enforcer: EVMContractAddress;
  terms: HexString;
  args: HexString;
}

/**
 * MetaMask Delegation Framework signed delegation (StatelessDelegator).
 * Matches the shape returned by `createDelegation` + `signDelegation`.
 */
export interface ISignedDelegation {
  delegate: EVMAccountAddress;
  delegator: EVMAccountAddress;
  authority: HexString;
  caveats: ReadonlyArray<IDelegationCaveat>;
  salt: HexString;
  signature: HexString;
}

/**
 * Wallet-persisted ERC-7715 grant: signed on-chain delegation plus host metadata.
 */
export interface IStoredDelegation {
  delegationId: DelegationId;
  /** Canonical fingerprint for revoke lookup (DelegationManager / kit hash). */
  delegationHash: HexString;
  chainId: EVMChainId;
  hostDomain: DomainString;
  memo: string;
  /** When the grant was stored. */
  createdAt: UnixTimestamp;
  /** Signed MetaMask delegation redeemable via ERC-7710. */
  delegation: ISignedDelegation;
  /** EIP-7715 response echo for `wallet_getGrantedExecutionPermissions`. */
  permissionResponse: IExecutionPermissionResponse;
}

/** List-row projection for the Delegations UI. */
export interface IDelegationSummary {
  delegationId: DelegationId;
  delegationHash: HexString;
  chainId: EVMChainId;
  hostDomain: DomainString;
  memo: string;
  createdAt: UnixTimestamp;
  /** Permission type string (e.g. `erc20-token-periodic`). */
  permissionType: string;
  to: EVMAccountAddress;
  /** ERC-20 period fields when present on the stored permission. */
  tokenAddress?: EVMAccountAddress;
  /** Hex atom amount per period (`0x…`). */
  periodAmount?: HexString;
  /** Period length in seconds. */
  periodDuration?: number;
}
