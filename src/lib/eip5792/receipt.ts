import { toHex, type Log, type TransactionReceipt } from "viem";

import { ERC20_TRANSFER_TOPIC } from "./constants";

export type ICallsStatusCode = 100 | 200 | 400 | 500;

export interface ICallsReceiptLog {
  address: string;
  data: string;
  topics: string[];
}

export interface ICallsReceipt {
  logs: ICallsReceiptLog[];
  status: "0x0" | "0x1";
  blockHash: string;
  blockNumber: string;
  gasUsed: string;
  transactionHash: string;
}

/**
 * Relayer `100` and `110` are still in flight. `200` needs a receipt before
 * the EIP status is known (success vs revert).
 */
export function callsStatusFromRelayer(
  relayerStatus: number,
): ICallsStatusCode | "needs-receipt" {
  if (relayerStatus === 200) return "needs-receipt";
  if (relayerStatus === 400) return 400;
  if (relayerStatus === 500) return 500;
  return 100;
}

export function eipStatusFromReceipt(status: TransactionReceipt["status"]): {
  status: 200 | 500;
  receiptStatus: "0x0" | "0x1";
} {
  if (status === "success") {
    return { status: 200, receiptStatus: "0x1" };
  }
  return { status: 500, receiptStatus: "0x0" };
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/** Last 20 bytes of an indexed address topic. */
export function addressFromTopic(topic: string | undefined): string | undefined {
  if (!topic || topic.length < 42) return undefined;
  return `0x${topic.slice(-40).toLowerCase()}`;
}

/**
 * Drop the relayer fee transfer and DelegationManager logs. User-call logs stay
 * in inclusion order.
 */
export function filterCallsReceiptLogs(
  logs: readonly Pick<Log, "address" | "data" | "topics">[],
  options: {
    delegationManager?: string;
    feeToken?: string;
    feeCollector?: string;
  },
): ICallsReceiptLog[] {
  const kept: ICallsReceiptLog[] = [];
  for (const log of logs) {
    if (
      options.delegationManager &&
      sameAddress(log.address, options.delegationManager)
    ) {
      continue;
    }
    const topic0 = log.topics[0]?.toLowerCase();
    const recipient = addressFromTopic(log.topics[2]);
    if (
      options.feeToken &&
      options.feeCollector &&
      sameAddress(log.address, options.feeToken) &&
      topic0 === ERC20_TRANSFER_TOPIC &&
      recipient !== undefined &&
      sameAddress(recipient, options.feeCollector)
    ) {
      continue;
    }
    kept.push({
      address: log.address,
      data: log.data,
      topics: log.topics.map((topic) => topic),
    });
  }
  return kept;
}

export function toCallsReceipt(
  receipt: TransactionReceipt,
  logs: ICallsReceiptLog[],
  receiptStatus: "0x0" | "0x1",
): ICallsReceipt {
  return {
    logs,
    status: receiptStatus,
    blockHash: receipt.blockHash,
    blockNumber: toHex(receipt.blockNumber),
    gasUsed: toHex(receipt.gasUsed),
    transactionHash: receipt.transactionHash,
  };
}
