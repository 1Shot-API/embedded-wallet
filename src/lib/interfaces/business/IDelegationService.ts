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

/** Phase-1 EIP-7715 permission type (ERC-20 period transfer). */
export const ERC20_TOKEN_PERIODIC = "erc20-token-periodic" as const;

export interface ICreateExecutionPermissionParams {
  request: IExecutionPermissionRequest;
  /** Final permission after grant UI attenuation. */
  permission: IExecutionPermission;
  memo: string;
  /** Called after delegation sign succeeds (e.g. mark session unlocked). */
  onDelegationSigned?: () => Promise<void>;
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
  createExecutionPermission(
    params: ICreateExecutionPermissionParams,
  ): Promise<IStoredDelegation>;

  cancelDelegation(
    params: ICancelDelegationParams,
  ): Promise<ICancelDelegationResult>;

  getSupportedExecutionPermissions(): Promise<SupportedExecutionPermissions>;

  getGrantedExecutionPermissions(): Promise<IExecutionPermissionResponse[]>;

  findByPermissionContext(
    permissionContext: HexString,
  ): Promise<IStoredDelegation | undefined>;
}

export const IDelegationServiceType = Symbol.for("IDelegationService");
