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

/** Kit scope: capped ERC-20 transfer. */
export const ERC20_TRANSFER_AMOUNT = "erc20-transfer-amount" as const;

/** Kit scope: ERC-20 streaming allowance. */
export const ERC20_STREAMING = "erc20-streaming" as const;

/** Kit scope: capped native token transfer. */
export const NATIVE_TRANSFER_AMOUNT = "native-transfer-amount" as const;

/** Kit scope: native token streaming allowance. */
export const NATIVE_STREAMING = "native-streaming" as const;

/** Kit scope: recurring native token transfers. */
export const NATIVE_PERIOD_TRANSFER = "native-period-transfer" as const;

/** Kit scope: transfer a specific ERC-721 token. */
export const ERC721_TRANSFER = "erc721-transfer" as const;

/** Kit scope: transfer contract ownership. */
export const OWNERSHIP_TRANSFER = "ownership-transfer" as const;

/** Kit scope: call specific functions on specific contracts. */
export const FUNCTION_CALL = "function-call" as const;

/** LiFiSwapEnforcer periodic swap permission (EIP-7715). */
export const LIFI_SWAP_PERIODIC = "lifi-swap-periodic" as const;

/**
 * One-time ERC-20 `approve(LiFi Diamond)` onboarding permission for LiFi swaps.
 * Separate from {@link LIFI_SWAP_PERIODIC} — do not encode both in one Delegation[].
 */
export const LIFI_SWAP_APPROVE = "lifi-swap-approve" as const;

export type ExecutionPermissionType =
  | typeof ERC20_TOKEN_PERIODIC
  | typeof ERC20_TRANSFER_AMOUNT
  | typeof ERC20_STREAMING
  | typeof NATIVE_TRANSFER_AMOUNT
  | typeof NATIVE_STREAMING
  | typeof NATIVE_PERIOD_TRANSFER
  | typeof ERC721_TRANSFER
  | typeof OWNERSHIP_TRANSFER
  | typeof FUNCTION_CALL
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
  /** Vault row when canceling from the Delegations tab. */
  stored?: IStoredDelegation;
  /**
   * EIP-7715 `permissionContext` (encoded delegation(s)) when revoking from
   * the host. Used when `stored` is omitted; also drives hash lookup.
   */
  permissionContext?: HexString;
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

  cancelDelegation(
    params: ICancelDelegationParams,
  ): Promise<ICancelDelegationResult>;

  /**
   * Remove a vault row (local cache + relayer blob) without submitting
   * on-chain `disableDelegation`. The signed delegation remains usable
   * by anyone who still holds it.
   */
  removeStoredDelegation(stored: IStoredDelegation): Promise<DelegationId>;

  getSupportedExecutionPermissions(): Promise<SupportedExecutionPermissions>;

  getGrantedExecutionPermissions(): Promise<IExecutionPermissionResponse[]>;

  findByPermissionContext(
    permissionContext: HexString,
  ): Promise<IStoredDelegation | undefined>;
}

export const IDelegationServiceType = Symbol.for("IDelegationService");
