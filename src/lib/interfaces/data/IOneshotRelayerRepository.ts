import type {
  EVMAccountAddress,
  EVMChainId,
  EVMTransactionHash,
  HexString,
  RelayerTransactionId,
  UriString,
} from "@1shotapi/ows-types";

export interface ISendTransactionResult {
  relayerTransactionId: RelayerTransactionId;
  transactionHash: EVMTransactionHash;
}

/**
 * Submits an EVM transaction (prepare + sign + broadcast).
 * Interim: eth_sendRawTransaction via public RPC; later: 1Shot relayer.
 */
export interface IOneshotRelayerRepository {
  sendTransaction(
    chainId: EVMChainId,
    contractAddress: EVMAccountAddress,
    transactionData: HexString,
    value?: bigint,
    options?: { webhookDestination?: UriString },
  ): Promise<ISendTransactionResult>;
}

export const IOneshotRelayerRepositoryType = Symbol.for(
  "IOneshotRelayerRepository",
);
