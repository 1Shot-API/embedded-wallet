import {
  EVMAccountAddress,
  EVMTransactionHash,
  HexString,
  RelayerTransactionIdSchema,
  type EVMChainId,
  type RelayerTransactionId,
} from "@1shotapi/ows-types";
import type {
  IOneshotRelayerRepository,
  IRelayer7710Params,
  IRelayerCapabilities,
  IRelayerEstimateResult,
  IRelayerFeeData,
  IRelayerStatusResult,
} from "../../interfaces/data/IOneshotRelayerRepository";

type JsonRpcSuccess<T> = { jsonrpc: "2.0"; id: unknown; result: T };
type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: unknown;
  error: { code: number; message: string; data?: unknown };
};

/** Public relayer JSON-RPC client (capabilities, fees, 7710 send/estimate/status). */
export class OneshotRelayerRepository implements IOneshotRelayerRepository {
  private readonly capabilitiesCache = new Map<string, IRelayerCapabilities>();

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
    const result = await this.postJsonRpc<RawEstimateResult>(
      relayerUrl,
      "relayer_estimate7710Transaction",
      stripEstimateFields(params),
    );
    return mapEstimateResult(result);
  }

  async estimate7710TransactionMultichain(
    relayerUrl: string,
    params: IRelayer7710Params[],
  ): Promise<IRelayerEstimateResult> {
    const result = await this.postJsonRpc<RawEstimateResult>(
      relayerUrl,
      "relayer_estimate7710TransactionMultichain",
      params.map(stripEstimateFields),
    );
    return mapEstimateResult(result);
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
    return parseTaskId(result, "relayer_send7710Transaction");
  }

  async send7710TransactionMultichain(
    relayerUrl: string,
    params: IRelayer7710Params[],
  ): Promise<RelayerTransactionId[]> {
    const result = await this.postJsonRpc<string[]>(
      relayerUrl,
      "relayer_send7710TransactionMultichain",
      params,
    );
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error(
        "relayer_send7710TransactionMultichain returned an invalid task id list",
      );
    }
    return result.map((id) =>
      parseTaskId(id, "relayer_send7710TransactionMultichain"),
    );
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

    if (!response.ok) {
      let detail = "";
      try {
        detail = await response.text();
      } catch {
        // ignore body read failures on error responses
      }
      throw new Error(
        `Relayer HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }

    const json = (await response.json()) as
      | JsonRpcSuccess<T>
      | JsonRpcFailure;

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

type RawEstimateResult = {
  success: boolean;
  paymentTokenAddress?: string;
  paymentChain?: number;
  gasUsed?: Record<string, string>;
  requiredPaymentAmount?: string;
  context?: string;
  contextByChainId?: Record<string, string>;
  error?: string;
};

function stripEstimateFields(params: IRelayer7710Params): IRelayer7710Params {
  const { context: _context, delegationSecret: _secret, ...estimateParams } =
    params;
  void _context;
  void _secret;
  return estimateParams;
}

function mapEstimateResult(result: RawEstimateResult): IRelayerEstimateResult {
  return {
    success: result.success,
    paymentTokenAddress: result.paymentTokenAddress
      ? EVMAccountAddress(result.paymentTokenAddress as `0x${string}`)
      : undefined,
    paymentChain: result.paymentChain,
    gasUsed: result.gasUsed ?? {},
    requiredPaymentAmount: result.requiredPaymentAmount,
    context: result.context,
    contextByChainId: result.contextByChainId,
    error: result.error,
  };
}

function parseTaskId(
  result: unknown,
  method: string,
): RelayerTransactionId {
  const parsed = RelayerTransactionIdSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error(`${method} returned an invalid task id`);
  }
  return parsed.data;
}
