import {
  BITCOIN_MAINNET_CHAIN_ID,
  BitcoinTransactionHash,
  type BitcoinChainId,
  type BitcoinSegwitAccountAddress,
} from "@1shotapi/ows-types";
import type {
  IBitcoinBalance,
  IBitcoinRpc,
} from "../../interfaces/data/IBitcoinRpc";
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";
import { BitcoinUtxo } from "../../types/domain/BitcoinUtxo";
import { makeBitcoinOutputIndex } from "../../types/primitives/BitcoinOutputIndex";
import {
  bitcoinSatoshiAmountFromAtomString,
  bitcoinSatoshiDeltaFromAtomString,
  makeBitcoinSatoshiAmount,
  makeBitcoinSatoshiDelta,
} from "../../types/primitives/BitcoinSatoshiAmount";
import type { BitcoinTransactionData } from "../../types/primitives/BitcoinTransactionData";

interface IJsonRpcResponse<T> {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: { code?: number; message?: string };
}

/** Blockbook / Ankr UTXO REST row (`GET …/api/v2/utxo/{address}`). */
interface IBlockbookUtxoRow {
  txid: string;
  vout: number;
  value: string;
  height?: number;
  confirmations?: number;
}

/** Mempool.space address stats (Bitcoin testnet3 indexer). */
interface IMempoolAddressResponse {
  chain_stats?: {
    funded_txo_sum?: number;
    spent_txo_sum?: number;
  };
  mempool_stats?: {
    funded_txo_sum?: number;
    spent_txo_sum?: number;
  };
}

interface IMempoolUtxoRow {
  txid: string;
  vout: number;
  value: number;
  status?: { confirmed?: boolean; block_height?: number };
}

/**
 * Ankr Bitcoin:
 * - Mainnet indexed reads via Blockbook REST
 *   (`https://rpc.ankr.com/premium-http/btc_blockbook/{token}/api/v2/…`)
 * - Mainnet fee / broadcast via JSON-RPC (`https://rpc.ankr.com/btc/{token}`)
 *
 * Ankr documents Signet as its only BTC test network, not Bitcoin testnet3
 * (`tb1` on mempool.space/testnet). Testnet3 therefore uses the public
 * mempool.space REST API for balance / UTXOs / fees / broadcast.
 */
export class AnkrBitcoinRpc implements IBitcoinRpc {
  constructor(protected readonly configProvider: IConfigProvider) {}

  protected async ankrApiKey(): Promise<string> {
    const { ankrBtcApiKey } = await this.configProvider.getConfig();
    return ankrBtcApiKey;
  }

  async getBalance(
    chainId: BitcoinChainId,
    address: BitcoinSegwitAccountAddress,
  ): Promise<IBitcoinBalance> {
    if (this.isMainnet(chainId)) {
      return this.blockbookGetBalance(address);
    }
    return this.mempoolGetBalance(address);
  }

  async listUnspent(
    chainId: BitcoinChainId,
    address: BitcoinSegwitAccountAddress,
  ): Promise<BitcoinUtxo[]> {
    if (this.isMainnet(chainId)) {
      return this.blockbookListUnspent(address);
    }
    return this.mempoolListUnspent(address);
  }

  async estimateFeeRateSatsPerVByte(chainId: BitcoinChainId): Promise<number> {
    if (this.isMainnet(chainId)) {
      const result = await this.jsonRpc<{
        feerate?: number;
        errors?: string[];
      }>("estimatesmartfee", [2, "ECONOMICAL"]);

      if (result?.feerate == null || result.feerate <= 0) {
        return 2;
      }
      // feerate is BTC/kB → sats/vB
      const satsPerVByte = (result.feerate * 1e8) / 1000;
      return Math.max(1, Math.ceil(satsPerVByte));
    }

    const res = await fetch(`${this.mempoolApiBase()}/v1/fees/recommended`);
    if (!res.ok) {
      throw new Error(`Bitcoin fee request failed (${res.status})`);
    }
    const body = (await res.json()) as { halfHourFee?: number; hourFee?: number };
    const fee = body.halfHourFee ?? body.hourFee ?? 2;
    return Math.max(1, Math.ceil(fee));
  }

  async sendRawTransaction(
    chainId: BitcoinChainId,
    rawTransaction: BitcoinTransactionData,
  ): Promise<BitcoinTransactionHash> {
    if (this.isMainnet(chainId)) {
      const txid = await this.jsonRpc<string>("sendrawtransaction", [
        rawTransaction,
      ]);
      if (!txid || typeof txid !== "string") {
        throw new Error("Bitcoin broadcast returned no txid");
      }
      return this.asTxid(txid);
    }

    const res = await fetch(`${this.mempoolApiBase()}/tx`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: rawTransaction,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Bitcoin broadcast failed (${res.status}): ${text || res.statusText}`,
      );
    }
    return this.asTxid(text.trim());
  }

  protected async blockbookGetBalance(
    address: BitcoinSegwitAccountAddress,
  ): Promise<IBitcoinBalance> {
    const base = await this.blockbookBase();
    const res = await fetch(
      `${base}/api/v2/address/${encodeURIComponent(address)}?details=basic`,
    );
    if (!res.ok) {
      throw new Error(
        `Bitcoin balance request failed (${res.status}): ${await res.text()}`,
      );
    }
    const body = (await res.json()) as {
      balance?: string;
      unconfirmedBalance?: string;
    };
    return {
      confirmed: bitcoinSatoshiAmountFromAtomString(body.balance ?? "0"),
      unconfirmed: bitcoinSatoshiDeltaFromAtomString(
        body.unconfirmedBalance ?? "0",
      ),
    };
  }

  protected async blockbookListUnspent(
    address: BitcoinSegwitAccountAddress,
  ): Promise<BitcoinUtxo[]> {
    // Omit confirmed=true so pending UTXOs are spendable (matches balance UX).
    const base = await this.blockbookBase();
    const res = await fetch(
      `${base}/api/v2/utxo/${encodeURIComponent(address)}`,
    );
    if (!res.ok) {
      throw new Error(
        `Bitcoin UTXO request failed (${res.status}): ${await res.text()}`,
      );
    }
    const body = (await res.json()) as IBlockbookUtxoRow[];
    if (!Array.isArray(body)) {
      throw new Error("Bitcoin UTXO response was not an array");
    }
    return body.map((row) => this.mapBlockbookUtxo(row));
  }

  protected async mempoolGetBalance(
    address: BitcoinSegwitAccountAddress,
  ): Promise<IBitcoinBalance> {
    const res = await fetch(
      `${this.mempoolApiBase()}/address/${encodeURIComponent(address)}`,
    );
    if (!res.ok) {
      throw new Error(
        `Bitcoin balance request failed (${res.status}): ${await res.text()}`,
      );
    }
    const body = (await res.json()) as IMempoolAddressResponse;
    const confirmed = makeBitcoinSatoshiAmount(
      BigInt(body.chain_stats?.funded_txo_sum ?? 0) -
        BigInt(body.chain_stats?.spent_txo_sum ?? 0),
    );
    const unconfirmed = makeBitcoinSatoshiDelta(
      BigInt(body.mempool_stats?.funded_txo_sum ?? 0) -
        BigInt(body.mempool_stats?.spent_txo_sum ?? 0),
    );
    return { confirmed, unconfirmed };
  }

  protected async mempoolListUnspent(
    address: BitcoinSegwitAccountAddress,
  ): Promise<BitcoinUtxo[]> {
    const res = await fetch(
      `${this.mempoolApiBase()}/address/${encodeURIComponent(address)}/utxo`,
    );
    if (!res.ok) {
      throw new Error(
        `Bitcoin UTXO request failed (${res.status}): ${await res.text()}`,
      );
    }
    const body = (await res.json()) as IMempoolUtxoRow[];
    if (!Array.isArray(body)) {
      throw new Error("Bitcoin UTXO response was not an array");
    }
    // Include unconfirmed UTXOs so faucet coins are spendable before confirm.
    return body.map((row) => this.mapMempoolUtxo(row));
  }

  protected mapBlockbookUtxo(row: IBlockbookUtxoRow): BitcoinUtxo {
    return new BitcoinUtxo(
      this.asTxid(row.txid),
      makeBitcoinOutputIndex(row.vout),
      bitcoinSatoshiAmountFromAtomString(row.value),
      row.confirmations,
    );
  }

  protected mapMempoolUtxo(row: IMempoolUtxoRow): BitcoinUtxo {
    return new BitcoinUtxo(
      this.asTxid(row.txid),
      makeBitcoinOutputIndex(row.vout),
      bitcoinSatoshiAmountFromAtomString(String(row.value)),
      row.status?.confirmed ? 1 : 0,
    );
  }

  protected asTxid(txid: string): BitcoinTransactionHash {
    const clean = txid.startsWith("0x") ? txid.slice(2) : txid.trim();
    if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
      throw new Error(`Invalid Bitcoin txid: ${txid}`);
    }
    return BitcoinTransactionHash(clean.toLowerCase());
  }

  protected isMainnet(chainId: BitcoinChainId): boolean {
    return chainId === BITCOIN_MAINNET_CHAIN_ID;
  }

  protected async blockbookBase(): Promise<string> {
    const key = await this.ankrApiKey();
    return `https://rpc.ankr.com/premium-http/btc_blockbook/${key}`;
  }

  protected async jsonRpcBase(): Promise<string> {
    const key = await this.ankrApiKey();
    return `https://rpc.ankr.com/btc/${key}`;
  }

  /** Bitcoin testnet3 public indexer (Ankr BTC test = Signet only). */
  protected mempoolApiBase(): string {
    return "https://mempool.space/testnet/api";
  }

  protected async jsonRpc<T>(
    method: string,
    params: unknown[],
  ): Promise<T> {
    const rpcUrl = await this.jsonRpcBase();
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });
    if (!res.ok) {
      throw new Error(`Bitcoin RPC ${method} failed (${res.status})`);
    }
    const body = (await res.json()) as IJsonRpcResponse<T>;
    if (body.error) {
      throw new Error(
        body.error.message ?? `Bitcoin RPC ${method} returned an error`,
      );
    }
    return body.result as T;
  }
}
