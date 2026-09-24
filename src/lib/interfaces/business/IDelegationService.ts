import type {
  EVMAccountAddress,
  EVMChainId,
  HexString,
  IExecutionPermission,
  IExecutionPermissionRequest,
  IExecutionPermissionResponse,
  SupportedExecutionPermissions,
} from "@1shotapi/ows-types";
import type { ISendTransactionResult } from "../data/IOneshotRelayerRepository";
import type { IStoredDelegation } from "../../types/domain/StoredDelegation";
import type { DelegationId } from "../../types/primitives/DelegationId";
import type { IRelayerSendUiCallbacks } from "../../types/domain/RelayerSendUi";
import type { TokenAmount } from "../../types/primitives";
import type { ITransactionWork } from "./ITransactionService";

/** Phase-1 EIP-7715 permission type (ERC-20 period transfer). */
export const ERC20_TOKEN_PERIODIC = "erc20-token-periodic" as const;

/** LiFiSwapEnforcer periodic swap permission (EIP-7715). */
export const LIFI_SWAP_PERIODIC = "lifi-swap-periodic" as const;

/**
 * One-time ERC-20 `approve(LiFi Diamond)` onboarding permission for LiFi swaps.
 * Separate from {@link LIFI_SWAP_PERIODIC} — do not encode both in one Delegation[].
 */
export const LIFI_SWAP_APPROVE = "lifi-swap-approve" as const;

export type ExecutionPermissionType =
  | typeof ERC20_TOKEN_PERIODIC
  | typeof LIFI_SWAP_PERIODIC
  | typeof LIFI_SWAP_APPROVE;

export interface ICreateExecutionPermissionParams {
  request: IExecutionPermissionRequest;
  /** Final permission after grant UI attenuation. */
  permission: IExecutionPermission;
  memo: string;
}

export interface ICreateExecutionPermissionsParams {
  items: ICreateExecutionPermissionParams[];
  /** Called after all delegation signs succeed (e.g. mark session unlocked). */
  onDelegationsSigned?: () => Promise<void>;
}

export interface ICancelDelegationParams extends IRelayerSendUiCallbacks {
  chainId: EVMChainId;
  paymentToken: EVMAccountAddress;
  feeAtoms: TokenAmount;
  /** Fee payment chain — defaults to `chainId`. */
  paymentChainId?: EVMChainId;
  /** Vault row when canceling from the Delegations tab. */
  stored?: IStoredDelegation;
  /**
   * EIP-7715 `permissionContext` (encoded delegation(s)) when revoking from
   * the host. Used when `stored` is omitted; also drives hash lookup.
   */
  permissionContext?: HexString;
}

/** One row in a batch cancel (vault and/or host permissionContext). */
export type ICancelDelegationItem = {
  chainId: EVMChainId;
  stored?: IStoredDelegation;
  permissionContext?: HexString;
};

export interface ICancelDelegationsParams extends IRelayerSendUiCallbacks {
  items: readonly ICancelDelegationItem[];
  /** Fee token (local-first / Arc USDC) — one payment for the whole batch. */
  paymentToken: EVMAccountAddress;
  feeAtoms: TokenAmount;
  paymentChainId: EVMChainId;
}

export type IBuildCancelWorkParams = {
  chainId: EVMChainId;
  stored?: IStoredDelegation;
  permissionContext?: HexString;
};

export interface ICancelDelegationResult extends ISendTransactionResult {
  /** Set when a known vault entry was deleted after on-chain cancel. */
  deletedDelegationId?: DelegationId;
}

export interface ICancelDelegationsResult {
  results: Array<ICancelDelegationResult & { chainId: EVMChainId }>;
}

/**
 * Create / cancel MetaMask StatelessDelegator execution permissions (EIP-7715).
 * Does not inject {@link import("./ITransactionService").ITransactionService} —
 * shared plumbing via business
 * {@link import("./utils/ITransactionUtils").ITransactionUtils}.
 */
export interface IDelegationService {
  createExecutionPermissions(
    params: ICreateExecutionPermissionsParams,
  ): Promise<IStoredDelegation[]>;

  /** ExactCalldata work for unsigned fee estimate before cancel confirm. */
  buildCancelWork(params: IBuildCancelWorkParams): Promise<ITransactionWork>;

  /**
   * Disable one or more delegations. Groups ExactCalldata work by execution
   * chain and submits one Multichain (or single-chain) 7710 send — one fee,
   * one passkey. Returns one result per execution chain.
   */
  cancelDelegations(
    params: ICancelDelegationsParams,
  ): Promise<ICancelDelegationsResult>;

  /** Single-delegation cancel — thin wrapper over {@link cancelDelegations}. */
  cancelDelegation(
    params: ICancelDelegationParams,
  ): Promise<ICancelDelegationResult>;

  /**
   * Remove a vault row (local cache + relayer blob) without submitting
   * on-chain `disableDelegation`. The signed delegation remains usable
   * by anyone who still holds it.
   */
  removeStoredDelegation(stored: IStoredDelegation): Promise<DelegationId>;

  /**
   * Remove multiple vault rows without on-chain `disableDelegation`.
   */
  removeStoredDelegations(
    storedList: readonly IStoredDelegation[],
  ): Promise<DelegationId[]>;

  getSupportedExecutionPermissions(): Promise<SupportedExecutionPermissions>;

  getGrantedExecutionPermissions(): Promise<IExecutionPermissionResponse[]>;

  findByPermissionContext(
    permissionContext: HexString,
  ): Promise<IStoredDelegation | undefined>;
}

export const IDelegationServiceType = Symbol.for("IDelegationService");
