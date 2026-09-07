import type {
  BitcoinChainId,
  BitcoinSegwitAccountAddress,
  BitcoinTransactionHash,
} from "@1shotapi/ows-types";
import type { IBitcoinBalance } from "../data/IBitcoinRpc";
import type { BitcoinSatoshiAmount } from "../../types/primitives/BitcoinSatoshiAmount";
import type { BitcoinTransactionData } from "../../types/primitives/BitcoinTransactionData";

export interface IBitcoinSendParams {
  chainId: BitcoinChainId;
  from: BitcoinSegwitAccountAddress;
  to: BitcoinSegwitAccountAddress;
  /** Amount in satoshis (not including network fee). */
  amountSats: BitcoinSatoshiAmount;
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
}

export const IBitcoinServiceType = Symbol.for("IBitcoinService");
