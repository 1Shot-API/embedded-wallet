import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  EVMTransactionHash,
  HexString,
  RelayerTransactionId,
} from "@1shotapi/ows-types";

export interface ISendTransactionResult {
  relayerTransactionId: RelayerTransactionId;
  transactionHash: EVMTransactionHash;
}

export interface IRelayerPaymentToken {
  address: EVMContractAddress;
  symbol: string;
  name?: string;
  decimals: number;
}

export interface IRelayerCapabilities {
  feeCollector: EVMAccountAddress;
  targetAddress: EVMAccountAddress;
  tokens: IRelayerPaymentToken[];
}

export interface IRelayerFeeData {
  chainId: string;
  token: IRelayerPaymentToken;
  rate: number;
  minFee: string;
  expiry: number;
  gasPrice: HexString;
  feeCollector: EVMAccountAddress;
  targetAddress?: EVMAccountAddress;
  context?: string;
}

export interface IRelayer7710Execution {
  /** Call target — EOA or contract (e.g. ERC-20 fee token). */
  target: EVMAccountAddress | EVMContractAddress;
  value: string;
  data: HexString;
}

export interface IRelayer7710TransactionEntry {
  permissionContext: unknown[];
  executions: IRelayer7710Execution[];
}

export interface IRelayerAuthorizationEntry {
  address: `0x${string}`;
  chainId: number;
  nonce: number;
  r: `0x${string}`;
  s: `0x${string}`;
  yParity: number;
}

export interface IRelayer7710Params {
  chainId: string;
  transactions: IRelayer7710TransactionEntry[];
  authorizationList?: IRelayerAuthorizationEntry[];
  context?: string;
  memo?: string;
  delegationSecret?: string;
  /** URL for transaction status update webhooks from the 1Shot Relayer (≤256 chars). */
  destinationUrl?: string;
}

export interface IRelayerEstimateResult {
  success: boolean;
  paymentTokenAddress?: EVMContractAddress;
  paymentChain?: number;
  gasUsed: Record<string, string>;
  requiredPaymentAmount?: string;
  context?: string;
  /** Per-chain signed quotes for multichain send (`params[i].context`). */
  contextByChainId?: Record<string, string>;
  error?: string;
}

export type ERelayerTaskStatus = 100 | 110 | 200 | 400 | 500;

export interface IRelayerStatusResult {
  id: string;
  status: ERelayerTaskStatus;
  chainId?: string;
  hash?: EVMTransactionHash;
  message?: string;
  memo?: string;
}

/**
 * Data client for the public 1Shot relayer JSON-RPC.
 * Orchestration lives in business {@link import("../business/utils/ITransactionUtils").ITransactionUtils}
 * / {@link import("../business/ITransactionService").ITransactionService}.
 * Raw eth_sendRawTransaction lives on {@link import("./IEVMRepository").IEVMRepository}.
 */
export interface IOneshotRelayerRepository {
  getCapabilities(
    relayerUrl: string,
    chainId: EVMChainId,
  ): Promise<IRelayerCapabilities>;

  getFeeData(
    relayerUrl: string,
    chainId: EVMChainId,
    token: EVMContractAddress,
  ): Promise<IRelayerFeeData>;

  estimate7710Transaction(
    relayerUrl: string,
    params: IRelayer7710Params,
  ): Promise<IRelayerEstimateResult>;

  estimate7710TransactionMultichain(
    relayerUrl: string,
    params: IRelayer7710Params[],
  ): Promise<IRelayerEstimateResult>;

  send7710Transaction(
    relayerUrl: string,
    params: IRelayer7710Params,
  ): Promise<RelayerTransactionId>;

  send7710TransactionMultichain(
    relayerUrl: string,
    params: IRelayer7710Params[],
  ): Promise<RelayerTransactionId[]>;

  getStatus(
    relayerUrl: string,
    taskId: RelayerTransactionId,
  ): Promise<IRelayerStatusResult>;
}

export const IOneshotRelayerRepositoryType = Symbol.for(
  "IOneshotRelayerRepository",
);
