import type { BitcoinTransactionHash } from "@1shotapi/ows-types";
import type { BitcoinOutputIndex } from "../primitives/BitcoinOutputIndex";
import type { BitcoinSatoshiAmount } from "../primitives/BitcoinSatoshiAmount";

/**
 * A confirmed (or listed) unspent transaction output owned by a SegWit address.
 */
export class BitcoinUtxo {
  public constructor(
    /** Parent transaction id (txid) that created this output. */
    public readonly transactionId: BitcoinTransactionHash,
    /** Output index within that parent transaction (Bitcoin `vout`). */
    public readonly outputIndex: BitcoinOutputIndex,
    /** Value of this output in satoshis. */
    public readonly valueSats: BitcoinSatoshiAmount,
    /** Confirmations on the parent transaction, when the RPC provides them. */
    public readonly confirmations?: number,
  ) {}
}
