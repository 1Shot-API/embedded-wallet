import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EVMAccountAddress,
  EVMContractAddress,
  HexString,
} from "@1shotapi/ows-types";
import { encodeFunctionData, erc20Abi } from "viem";

import { TransactionUtils } from "@/lib/implementations/utils/TransactionUtils.ts";
import type { IHostOriginProvider } from "@/lib/interfaces/utils/IHostOriginProvider.ts";

const TOKEN = EVMContractAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const SPENDER = EVMAccountAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
const RECIPIENT = EVMAccountAddress("0x1111111111111111111111111111111111111111");

const utils = new TransactionUtils({
  getHostDomain: () => null,
} as IHostOriginProvider);

function call(functionName: "transfer" | "approve", amount: bigint): HexString {
  const address = functionName === "transfer" ? RECIPIENT : SPENDER;
  return HexString(
    encodeFunctionData({
      abi: erc20Abi,
      functionName,
      args: [address, amount],
    }),
  );
}

describe("TransactionUtils.tryDecodeErc20", () => {
  it("decodes a transfer and an approval", () => {
    const transfer = utils.tryDecodeErc20(TOKEN, call("transfer", 2_000_000n));
    assert.deepEqual(transfer, {
      kind: "transfer",
      tokenAddress: TOKEN,
      recipient: RECIPIENT,
      amount: 2_000_000n,
    });

    const approve = utils.tryDecodeErc20(TOKEN, call("approve", 2_000_000n));
    assert.deepEqual(approve, {
      kind: "approve",
      tokenAddress: TOKEN,
      spender: SPENDER,
      amount: 2_000_000n,
    });
  });

  it("returns null for empty calldata and other selectors", () => {
    assert.equal(utils.tryDecodeErc20(TOKEN, HexString("0x")), null);
    assert.equal(
      utils.tryDecodeErc20(
        TOKEN,
        HexString(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [RECIPIENT],
          }),
        ),
      ),
      null,
    );
  });
});

describe("TransactionUtils.formatErc20ApproveAmount", () => {
  it("formats a finite amount and labels 2^255 as Unlimited", () => {
    assert.equal(utils.formatErc20ApproveAmount(2_000_000n, 6), "2");
    assert.equal(utils.formatErc20ApproveAmount(1n << 255n, 6), "Unlimited");
    assert.equal(
      utils.formatErc20ApproveAmount((1n << 256n) - 1n, 6),
      "Unlimited",
    );
  });
});
