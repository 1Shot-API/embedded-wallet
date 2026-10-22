import {
  ChainUtils,
  parseTransactionHash,
  type TransactionHash,
} from "@1shotapi/ows-types";

import {
  type ICctpInFlightBurn,
  type ICircleRepository,
  type IIrisCctpMessage,
  type IIrisForwardingFee,
} from "../../interfaces/data/ICircleRepository";
import type { ECircleDomainId } from "../../types/enum/ECircleDomainId";

export const CCTP_IN_FLIGHT_KEY_PREFIX = "oneshot.cctpInFlight.";

export function inFlightStorageKey(address: string): string {
  return `${CCTP_IN_FLIGHT_KEY_PREFIX}${String(address).toLowerCase()}`;
}

type IStoredInFlight = {
  burnTxHash: string;
  sourceDomain: number;
  sourceChainId: string;
  destChainId: string;
  amountAtoms: string;
  address: string;
};

export function serializeInFlight(record: ICctpInFlightBurn): string {
  const stored: IStoredInFlight = {
    burnTxHash: record.burnTxHash,
    sourceDomain: record.sourceDomain,
    sourceChainId: String(record.sourceChainId),
    destChainId: String(record.destChainId),
    amountAtoms: record.amountAtoms.toString(10),
    address: record.address,
  };
  return JSON.stringify(stored);
}

export function parseInFlight(raw: string): ICctpInFlightBurn | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const row = parsed as Partial<IStoredInFlight>;
  if (
    typeof row.burnTxHash !== "string" ||
    row.burnTxHash.length === 0 ||
    typeof row.sourceDomain !== "number" ||
    typeof row.sourceChainId !== "string" ||
    typeof row.destChainId !== "string" ||
    typeof row.amountAtoms !== "string" ||
    typeof row.address !== "string" ||
    row.address.length === 0
  ) {
    return null;
  }
  let amountAtoms: bigint;
  try {
    amountAtoms = BigInt(row.amountAtoms);
  } catch {
    return null;
  }
  const sourceChainId = parseOwsChainId(row.sourceChainId);
  const destChainId = parseOwsChainId(row.destChainId);
  if (!sourceChainId || !destChainId) {
    return null;
  }
  const burnTxHash = parseTransactionHash(row.burnTxHash);
  if (!burnTxHash) {
    return null;
  }
  return {
    burnTxHash,
    sourceDomain: row.sourceDomain as ECircleDomainId,
    sourceChainId,
    destChainId,
    amountAtoms,
    address: row.address,
  };
}

function parseOwsChainId(value: string): ICctpInFlightBurn["sourceChainId"] | null {
  try {
    if (ChainUtils.isSolanaChainId(value)) {
      return ChainUtils.asSolanaChainId(value);
    }
    if (ChainUtils.isBitcoinChainId(value)) {
      return value;
    }
    return ChainUtils.asEVMChainId(value);
  } catch {
    return null;
  }
}

type IrisFeeAmount = string | number;

type IrisFeeJson = {
  finalityThreshold?: number;
  minimumFee?: number;
  forwardFee?: { low?: IrisFeeAmount; med?: IrisFeeAmount; high?: IrisFeeAmount };
};

type IrisMessagesJson = {
  messages?: Array<{
    status?: string;
    forwardTxHash?: string | null;
    message?: string;
    attestation?: string | null;
  }>;
};

/**
 * Circle Iris CCTP V2 client. HTTP only — no BridgeKit.
 */
export class CircleRepository implements ICircleRepository {
  async getForwardingFees(
    irisBaseUrl: string,
    sourceDomain: ECircleDomainId,
    destDomain: ECircleDomainId,
  ): Promise<IIrisForwardingFee[]> {
    const url = `${trimSlash(irisBaseUrl)}/v2/burn/USDC/fees/${sourceDomain}/${destDomain}?forward=true`;
    const json = await getJson<unknown>(url);
    const rows = Array.isArray(json) ? json : [];
    const fees: IIrisForwardingFee[] = [];
    for (const item of rows) {
      const fee = parseFeeRow(item);
      if (fee) {
        fees.push(fee);
      }
    }
    if (fees.length === 0) {
      throw new Error("Iris returned no forwarding fees");
    }
    return fees;
  }

  async getMessageByBurnTx(
    irisBaseUrl: string,
    sourceDomain: ECircleDomainId,
    txHash: TransactionHash,
  ): Promise<IIrisCctpMessage | null> {
    const url = `${trimSlash(irisBaseUrl)}/v2/messages/${sourceDomain}?transactionHash=${encodeURIComponent(String(txHash))}`;
    try {
      const json = await getJson<IrisMessagesJson>(url);
      const first = json.messages?.[0];
      if (!first) {
        return null;
      }
      const forwardRaw =
        typeof first.forwardTxHash === "string" && first.forwardTxHash.length > 0
          ? first.forwardTxHash
          : null;
      const forwardTxHash = forwardRaw
        ? parseTransactionHash(forwardRaw)
        : null;
      return {
        status: first.status,
        forwardTxHash,
        message: first.message,
        attestation: first.attestation,
      };
    } catch (error: unknown) {
      if (
        error instanceof IrisHttpError &&
        (error.status === 404 || error.status === 429)
      ) {
        return null;
      }
      throw error;
    }
  }

  saveInFlight(record: ICctpInFlightBurn): void {
    try {
      localStorage.setItem(
        inFlightStorageKey(record.address),
        serializeInFlight(record),
      );
    } catch {
      // Quota / private mode — polling still works for this session.
    }
  }

  loadInFlight(address: string): ICctpInFlightBurn | null {
    try {
      const raw = localStorage.getItem(inFlightStorageKey(address));
      if (!raw) {
        return null;
      }
      return parseInFlight(raw);
    } catch {
      return null;
    }
  }

  clearInFlight(address: string): void {
    try {
      localStorage.removeItem(inFlightStorageKey(address));
    } catch {
      // ignore
    }
  }
}

class IrisHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "IrisHttpError";
  }
}

/** Exported for unit tests — Iris fee rows vary string vs number atom amounts. */
export function parseFeeRow(item: unknown): IIrisForwardingFee | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const row = item as IrisFeeJson;
  if (
    typeof row.finalityThreshold !== "number" ||
    typeof row.minimumFee !== "number" ||
    !row.forwardFee
  ) {
    return null;
  }
  const med = normalizeIrisAmount(row.forwardFee.med);
  if (med === null) {
    return null;
  }
  const low = normalizeIrisAmount(row.forwardFee.low) ?? med;
  const high = normalizeIrisAmount(row.forwardFee.high) ?? med;
  return {
    finalityThreshold: row.finalityThreshold,
    minimumFee: row.minimumFee,
    forwardFee: { low, med, high },
  };
}

function normalizeIrisAmount(value: IrisFeeAmount | undefined): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return null;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new IrisHttpError(
      response.status,
      `Iris ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as T;
}

function trimSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
