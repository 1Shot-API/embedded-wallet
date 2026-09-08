import type {
  BitcoinChainId,
  BitcoinSegwitAccountAddress,
  BitcoinTransactionHash,
} from "@1shotapi/ows-types";
import type { BitcoinUtxo } from "../../types/domain/BitcoinUtxo";
import type { BitcoinSatoshiAmount } from "../../types/primitives/BitcoinSatoshiAmount";
import type { BitcoinTransactionData } from "../../types/primitives/BitcoinTransactionData";

/** Confirmed chain balance plus pending (mempool) delta, both in satoshis. */
export interface IBitcoinBalance {
  confirmed: BitcoinSatoshiAmount;
  /** Pending delta; may be negative when pending spends exceed receives. */
  unconfirmed: BitcoinSatoshiAmount;
}

export interface IBitcoinRpc {
  getBalance(
    chainId: BitcoinChainId,
    address: BitcoinSegwitAccountAddress,
  ): Promise<IBitcoinBalance>;

  listUnspent(
    chainId: BitcoinChainId,
    address: BitcoinSegwitAccountAddress,
  ): Promise<BitcoinUtxo[]>;

  /** Estimated fee rate in satoshis per virtual byte. */
  estimateFeeRateSatsPerVByte(chainId: BitcoinChainId): Promise<number>;

  sendRawTransaction(
    chainId: BitcoinChainId,
    rawTransaction: BitcoinTransactionData,
  ): Promise<BitcoinTransactionHash>;
}

export const IBitcoinRpcType = Symbol.for("IBitcoinRpc");
