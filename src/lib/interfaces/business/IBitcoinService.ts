import type {
  BitcoinAddress,
  BitcoinChainId,
  BitcoinSegwitAccountAddress,
  BitcoinTransactionHash,
} from "@1shotapi/ows-types";

import type { BitcoinSatoshiAmount } from "../../types/primitives/BitcoinSatoshiAmount";
import type { BitcoinTransactionData } from "../../types/primitives/BitcoinTransactionData";
import type { IBitcoinBalance } from "../data/IBitcoinRpc";

export interface IBitcoinSendQuote {
  feeSats: BitcoinSatoshiAmount;
  changeSats: BitcoinSatoshiAmount;
  /** Address that receives change. Absent when change is dust. */
  changeAddress?: BitcoinAddress;
}

export interface IBitcoinSendParams {
  chainId: BitcoinChainId;
  from: BitcoinSegwitAccountAddress;
  /** Any standard address on `chainId`. */
  to: BitcoinAddress;
  /** Amount in satoshis (not including network fee). */
  amountSats: BitcoinSatoshiAmount;
  /** Change destination. Defaults to `from`. */
  changeAddress?: BitcoinAddress;
  /** OP_RETURN payload, at most 80 bytes. */
  memo?: Uint8Array;
  /** Called after coin selection and before the passkey ceremony. */
  confirmSpend?: (quote: IBitcoinSendQuote) => Promise<void>;
}

export interface IBitcoinSendResult {
  txid: BitcoinTransactionHash;
  feeSats: BitcoinSatoshiAmount;
  rawTransaction: BitcoinTransactionData;
}

export interface IBitcoinService {
  getBalance(
    chainId: BitcoinChainId,
    address: BitcoinSegwitAccountAddress,
  ): Promise<IBitcoinBalance>;

  send(params: IBitcoinSendParams): Promise<IBitcoinSendResult>;

  /** Broadcast an already-signed raw transaction. */
  broadcast(
    chainId: BitcoinChainId,
    rawTransaction: BitcoinTransactionData,
  ): Promise<BitcoinTransactionHash>;
}

export const IBitcoinServiceType = Symbol.for("IBitcoinService");
