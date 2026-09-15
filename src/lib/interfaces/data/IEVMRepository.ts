import type {
  EVMAccountAddress,
  EVMChainId,
  HexString,
} from "@1shotapi/ows-types";
import type { ISendTransactionResult } from "./IOneshotRelayerRepository";

export interface IEvmGasOverrides {
  gas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasPrice?: bigint;
}

/**
 * Direct EVM chain access: prepare + sign + eth_sendRawTransaction.
 * Distinct from the public 1Shot relayer ({@link IOneshotRelayerRepository}).
 */
export interface IEVMRepository {
  broadcastRawTransaction(
    chainId: EVMChainId,
    to: EVMAccountAddress,
    data: HexString,
    value?: bigint,
    gasOverrides?: IEvmGasOverrides,
  ): Promise<ISendTransactionResult>;
}

export const IEVMRepositoryType = Symbol.for("IEVMRepository");
