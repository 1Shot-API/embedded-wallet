import type {
  EVMAccountAddress,
  EVMChainId,
  EVMTransactionHash,
  HexString,
  RelayerTransactionId,
} from "@1shotapi/ows-types";

export interface ISendTransactionResult {
  relayerTransactionId: RelayerTransactionId;
  transactionHash: EVMTransactionHash;
}

export interface IRelayerPaymentToken {
  address: EVMAccountAddress;
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
  target: EVMAccountAddress;
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
}

export interface IRelayerEstimateResult {
  success: boolean;
  paymentTokenAddress?: EVMAccountAddress;
  paymentChain?: number;
  gasUsed: Record<string, string>;
  requiredPaymentAmount?: string;
  context?: string;
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
 * Data client for the public 1Shot relayer JSON-RPC + interim raw broadcast.
 * Orchestration lives in business {@link import("../business/utils/ITransactionUtils").ITransactionUtils}
 * / {@link import("../business/ITransactionService").ITransactionService}.
 */
export interface IOneshotRelayerRepository {
  getCapabilities(
    relayerUrl: string,
    chainId: EVMChainId,
  ): Promise<IRelayerCapabilities>;

  getFeeData(
    relayerUrl: string,
    chainId: EVMChainId,
    token: EVMAccountAddress,
  ): Promise<IRelayerFeeData>;

  estimate7710Transaction(
    relayerUrl: string,
    params: IRelayer7710Params,
  ): Promise<IRelayerEstimateResult>;

  send7710Transaction(
    relayerUrl: string,
    params: IRelayer7710Params,
  ): Promise<RelayerTransactionId>;

  getStatus(
    relayerUrl: string,
    taskId: RelayerTransactionId,
  ): Promise<IRelayerStatusResult>;

  /** Non-relayer path: prepare + sign + eth_sendRawTransaction. */
  broadcastRawTransaction(
    chainId: EVMChainId,
    to: EVMAccountAddress,
    data: HexString,
    value?: bigint,
  ): Promise<ISendTransactionResult>;
}

export const IOneshotRelayerRepositoryType = Symbol.for(
  "IOneshotRelayerRepository",
);
