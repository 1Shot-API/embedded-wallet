import { prepareEvmTransaction } from "@1shotapi/ows-signer-utils";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  EVMTransactionHash,
  HexString,
  OwsInvalidParamsError,
  RelayerTransactionId,
  type EVMChainId,
} from "@1shotapi/ows-types";
import type {
  IOneshotRelayerRepository,
  IRelayer7710Params,
  IRelayerCapabilities,
  IRelayerEstimateResult,
  IRelayerFeeData,
  IRelayerStatusResult,
  ISendTransactionResult,
} from "../../interfaces/data/IOneshotRelayerRepository";
import type { IOWSProvider } from "../../interfaces/utils/IOWSProvider";

const ZERO_VALUE = HexString("0x0");
const EMPTY_DATA = HexString("0x");

export type OneshotRelayerRepositoryOptions = {
  blockchain: IBlockchainProvider;
  owsProvider: IOWSProvider;
};

type JsonRpcSuccess<T> = { jsonrpc: "2.0"; id: unknown; result: T };
type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: unknown;
  error: { code: number; message: string; data?: unknown };
};

/**
 * Public relayer JSON-RPC client + interim eth_sendRawTransaction broadcast.
 */
export class OneshotRelayerRepository implements IOneshotRelayerRepository {
  private readonly capabilitiesCache = new Map<string, IRelayerCapabilities>();

  constructor(private readonly options: OneshotRelayerRepositoryOptions) {}

  async getCapabilities(
    relayerUrl: string,
    chainId: EVMChainId,
  ): Promise<IRelayerCapabilities> {
    const decimal = chainIdToDecimal(chainId);
    const cacheKey = `${relayerEndpoint(relayerUrl)}:${decimal}`;
    const cached = this.capabilitiesCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.postJsonRpc<
      Record<
        string,
        {
          feeCollector: string;
          targetAddress: string;
          tokens: Array<{
            address: string;
            symbol?: string;
            name?: string;
            decimals: number | string;
          }>;
        }
      >
    >(relayerUrl, "relayer_getCapabilities", [decimal]);

    const entry = result[decimal];
    if (!entry) {
      throw new Error(`Relayer has no capabilities for chain ${decimal}`);
    }

    const capabilities: IRelayerCapabilities = {
      feeCollector: EVMAccountAddress(entry.feeCollector as `0x${string}`),
      targetAddress: EVMAccountAddress(entry.targetAddress as `0x${string}`),
      tokens: entry.tokens.map((token) => ({
        address: EVMAccountAddress(token.address as `0x${string}`),
        symbol: token.symbol ?? "TOKEN",
        name: token.name,
        decimals: Number(token.decimals),
      })),
    };
    this.capabilitiesCache.set(cacheKey, capabilities);
    return capabilities;
  }

  async getFeeData(
    relayerUrl: string,
    chainId: EVMChainId,
    token: ReturnType<typeof EVMAccountAddress>,
  ): Promise<IRelayerFeeData> {
    const decimal = chainIdToDecimal(chainId);
    const result = await this.postJsonRpc<{
      chainId: string;
      token: {
        address: string;
        decimals: number | string;
        symbol?: string;
        name?: string;
      };
      rate: number;
      minFee: string;
      expiry: number;
      gasPrice: string;
      feeCollector: string;
      targetAddress?: string;
      context?: string;
    }>(relayerUrl, "relayer_getFeeData", {
      chainId: decimal,
      token: String(token),
    });

    return {
      chainId: result.chainId,
      token: {
        address: EVMAccountAddress(result.token.address as `0x${string}`),
        symbol: result.token.symbol ?? "TOKEN",
        name: result.token.name,
        decimals: Number(result.token.decimals),
      },
      rate: result.rate,
      minFee: result.minFee,
      expiry: result.expiry,
      gasPrice: HexString(result.gasPrice as `0x${string}`),
      feeCollector: EVMAccountAddress(result.feeCollector as `0x${string}`),
      targetAddress: result.targetAddress
        ? EVMAccountAddress(result.targetAddress as `0x${string}`)
        : undefined,
      context: result.context,
    };
  }

  async estimate7710Transaction(
    relayerUrl: string,
    params: IRelayer7710Params,
  ): Promise<IRelayerEstimateResult> {
    const { context: _context, delegationSecret: _secret, ...estimateParams } =
      params;
    void _context;
    void _secret;

    const result = await this.postJsonRpc<{
      success: boolean;
      paymentTokenAddress?: string;
      paymentChain?: number;
      gasUsed?: Record<string, string>;
      requiredPaymentAmount?: string;
      context?: string;
      error?: string;
    }>(relayerUrl, "relayer_estimate7710Transaction", estimateParams);

    return {
      success: result.success,
      paymentTokenAddress: result.paymentTokenAddress
        ? EVMAccountAddress(result.paymentTokenAddress as `0x${string}`)
        : undefined,
      paymentChain: result.paymentChain,
      gasUsed: result.gasUsed ?? {},
      requiredPaymentAmount: result.requiredPaymentAmount,
      context: result.context,
      error: result.error,
    };
  }

  async send7710Transaction(
    relayerUrl: string,
    params: IRelayer7710Params,
  ): Promise<RelayerTransactionId> {
    const result = await this.postJsonRpc<string>(
      relayerUrl,
      "relayer_send7710Transaction",
      params,
    );
    if (typeof result !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(result)) {
      throw new Error("relayer_send7710Transaction returned an invalid task id");
    }
    return RelayerTransactionId(result as `0x${string}`);
  }

  async getStatus(
    relayerUrl: string,
    taskId: RelayerTransactionId,
  ): Promise<IRelayerStatusResult> {
    const result = await this.postJsonRpc<{
      id: string;
      status: number;
      chainId?: string;
      hash?: string;
      message?: string;
      memo?: string;
      receipt?: { transactionHash?: string };
    }>(relayerUrl, "relayer_getStatus", {
      id: String(taskId),
      logs: false,
    });

    // Status 110 exposes top-level `hash`; status 200 puts it on `receipt.transactionHash`.
    const hashHex = result.hash ?? result.receipt?.transactionHash;

    return {
      id: result.id,
      status: result.status as IRelayerStatusResult["status"],
      chainId: result.chainId,
      hash: hashHex
        ? EVMTransactionHash(hashHex as `0x${string}`)
        : undefined,
      message: result.message,
      memo: result.memo,
    };
  }

  async broadcastRawTransaction(
    chainId: EVMChainId,
    to: ReturnType<typeof EVMAccountAddress>,
    data: HexString,
    value?: bigint,
  ): Promise<ISendTransactionResult> {
    const signer = await this.options.owsProvider.getSigner();
    const chainRpc = await this.options.owsProvider.getRpcHelper();
    const active = chainRpc.getChainId();
    if (active !== chainId) {
      throw new OwsInvalidParamsError(
        `sendTransaction chainId ${chainId} does not match active chain ${active}`,
      );
    }

    const from =
      signer.getCachedAddress?.() ?? (await signer.evm.getAccountAddress());
    const valueHex =
      value === undefined || value === 0n
        ? ZERO_VALUE
        : HexString(`0x${value.toString(16)}` as `0x${string}`);
    const txData = data || EMPTY_DATA;

    const prepared = await prepareEvmTransaction(chainRpc, from, {
      from,
      to,
      data: txData,
      value: valueHex,
      chainId,
    });
    const signed = await signer.evm.signTransaction(prepared);

    const client = this.options.blockchain.getPublicClient(chainId);
    const hash = await client.request({
      method: "eth_sendRawTransaction",
      params: [signed],
    });
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      throw new OwsInvalidParamsError(
        "eth_sendRawTransaction returned an invalid transaction hash",
      );
    }

    return {
      relayerTransactionId: RelayerTransactionId(
        `interim-${hash.slice(2, 18)}`,
      ),
      transactionHash: EVMTransactionHash(hash as `0x${string}`),
    };
  }

  private async postJsonRpc<T>(
    relayerUrl: string,
    method: string,
    params: unknown,
  ): Promise<T> {
    const endpoint = relayerEndpoint(relayerUrl);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });

    const json = (await response.json()) as
      | JsonRpcSuccess<T>
      | JsonRpcFailure;

    if (!response.ok) {
      throw new Error(
        `Relayer HTTP ${response.status}: ${JSON.stringify(json)}`,
      );
    }
    if ("error" in json && json.error) {
      throw new Error(
        `Relayer ${method} error ${json.error.code}: ${json.error.message}`,
      );
    }
    if (!("result" in json)) {
      throw new Error(`Relayer ${method} returned no result`);
    }
    return json.result;
  }
}

function relayerEndpoint(relayerUrl: string): string {
  const trimmed = relayerUrl.replace(/\/$/, "");
  return trimmed.endsWith("/relayers") ? trimmed : `${trimmed}/relayers`;
}

function chainIdToDecimal(chainId: EVMChainId): string {
  return BigInt(chainId).toString(10);
}
