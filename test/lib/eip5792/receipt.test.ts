import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ERC20_TRANSFER_TOPIC } from "../../../src/lib/eip5792/constants.ts";
import {
  callsStatusFromRelayer,
  eipStatusFromReceipt,
  filterCallsReceiptLogs,
} from "../../../src/lib/eip5792/receipt.ts";

const FEE_TOKEN = "0x1111111111111111111111111111111111111111";
const FEE_COLLECTOR = "0x2222222222222222222222222222222222222222";
const DELEGATION_MANAGER = "0x3333333333333333333333333333333333333333";
const USER = "0x4444444444444444444444444444444444444444";

function topicAddress(address: string): `0x${string}` {
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
}

describe("EIP-5792 status mapping", () => {
  it("maps relayer pending and submitted to 100, and terminal codes through", () => {
    assert.equal(callsStatusFromRelayer(100), 100);
    assert.equal(callsStatusFromRelayer(110), 100);
    assert.equal(callsStatusFromRelayer(400), 400);
    assert.equal(callsStatusFromRelayer(500), 500);
    assert.equal(callsStatusFromRelayer(200), "needs-receipt");
  });

  it("reads success and revert off the receipt", () => {
    assert.deepEqual(eipStatusFromReceipt("success"), {
      status: 200,
      receiptStatus: "0x1",
    });
    assert.deepEqual(eipStatusFromReceipt("reverted"), {
      status: 500,
      receiptStatus: "0x0",
    });
  });

  it("drops the fee transfer and delegation manager logs", () => {
    const userLog = {
      address: FEE_TOKEN,
      data: "0x",
      topics: [
        ERC20_TRANSFER_TOPIC,
        topicAddress(USER),
        topicAddress(USER),
      ] as const,
    };
    const feeLog = {
      address: FEE_TOKEN,
      data: "0x",
      topics: [
        ERC20_TRANSFER_TOPIC,
        topicAddress(USER),
        topicAddress(FEE_COLLECTOR),
      ] as const,
    };
    const managerLog = {
      address: DELEGATION_MANAGER,
      data: "0x01",
      topics: ["0xabc"] as const,
    };
    const kept = filterCallsReceiptLogs([feeLog, managerLog, userLog], {
      delegationManager: DELEGATION_MANAGER,
      feeToken: FEE_TOKEN,
      feeCollector: FEE_COLLECTOR,
    });
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.topics[2], topicAddress(USER));
  });
});
