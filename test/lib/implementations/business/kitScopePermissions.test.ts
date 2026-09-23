import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ScopeType } from "@metamask/smart-accounts-kit";
import { getAddress } from "viem";
import {
  buildKitScopeAttenuatedPermission,
  buildKitScopeConfig,
  grantKindForPermissionType,
  validateKitScopeRequest,
} from "@/lib/implementations/business/kitScopePermissions.ts";
import {
  ERC20_STREAMING,
  ERC20_TRANSFER_AMOUNT,
  ERC721_TRANSFER,
  FUNCTION_CALL,
  NATIVE_PERIOD_TRANSFER,
  NATIVE_STREAMING,
  NATIVE_TRANSFER_AMOUNT,
  OWNERSHIP_TRANSFER,
} from "@/lib/interfaces/business/IDelegationService.ts";

const token = "0x" + "a".repeat(40);
const target = "0x" + "b".repeat(40);
const contract = "0x" + "c".repeat(40);

describe("grantKindForPermissionType", () => {
  it("maps kit wire types to grant modal kinds", () => {
    assert.equal(
      grantKindForPermissionType(ERC20_TRANSFER_AMOUNT),
      "grantErc20TransferPermission",
    );
    assert.equal(
      grantKindForPermissionType(FUNCTION_CALL),
      "grantFunctionCallPermission",
    );
    assert.equal(grantKindForPermissionType("lifi-swap-periodic"), null);
  });
});

describe("buildKitScopeConfig", () => {
  it("maps erc20-transfer-amount to kit scope", () => {
    const scope = buildKitScopeConfig({
      type: ERC20_TRANSFER_AMOUNT,
      isAdjustmentAllowed: false,
      data: {
        tokenAddress: token,
        maxAmount: "0x3e8",
      },
    });
    assert.equal(scope.type, ScopeType.Erc20TransferAmount);
    assert.equal(scope.maxAmount, 1000n);
  });

  it("maps function-call with value cap", () => {
    const scope = buildKitScopeConfig({
      type: FUNCTION_CALL,
      isAdjustmentAllowed: false,
      data: {
        targets: [target],
        selectors: ["0x12345678"],
        maxValue: "0x0",
      },
    });
    assert.equal(scope.type, ScopeType.FunctionCall);
    assert.deepEqual(scope.targets, [getAddress(target)]);
  });
});

describe("buildKitScopeAttenuatedPermission", () => {
  it("echoes native scope allowedCalldata on permission.data", () => {
    const result = buildKitScopeAttenuatedPermission(
      {
        type: NATIVE_TRANSFER_AMOUNT,
        isAdjustmentAllowed: false,
        data: {
          maxAmount: "0x64",
          allowedCalldata: [{ startIndex: 4, value: "0xdeadbeef" }],
        },
      },
      undefined,
    );
    const data = result.data as Record<string, unknown>;
    assert.ok(Array.isArray(data.allowedCalldata));
    assert.equal((data.allowedCalldata as unknown[]).length, 1);
  });

  it("throws when native scope has both allowedCalldata and exactCalldata", () => {
    assert.throws(
      () =>
        buildKitScopeAttenuatedPermission(
          {
            type: NATIVE_TRANSFER_AMOUNT,
            isAdjustmentAllowed: false,
            data: {
              maxAmount: "0x64",
              allowedCalldata: [{ startIndex: 4, value: "0xdeadbeef" }],
              exactCalldata: "0x00",
            },
          },
          undefined,
        ),
      /Cannot specify both allowedCalldata and exactCalldata/,
    );
  });

  it("echoes caveats onto permission.data", () => {
    const caveats = [
      { type: "allowedTargets" as const, data: { targets: [target] } },
    ];
    const result = buildKitScopeAttenuatedPermission(
      {
        type: NATIVE_TRANSFER_AMOUNT,
        isAdjustmentAllowed: false,
        data: { maxAmount: "0x64" },
      },
      caveats,
    );
    assert.equal(result.type, NATIVE_TRANSFER_AMOUNT);
    assert.equal((result.data as { maxAmount: string }).maxAmount, "0x64");
    assert.deepEqual((result.data as { caveats: unknown }).caveats, caveats);
  });
});

describe("validateKitScopeRequest", () => {
  it("accepts valid erc721 payload", () => {
    assert.equal(
      validateKitScopeRequest(ERC721_TRANSFER, {
        tokenAddress: token,
        tokenId: "42",
      }),
      true,
    );
  });

  it("rejects incomplete streaming payload", () => {
    assert.equal(
      validateKitScopeRequest(ERC20_STREAMING, { tokenAddress: token }),
      false,
    );
  });

  it("accepts native period transfer", () => {
    assert.equal(
      validateKitScopeRequest(NATIVE_PERIOD_TRANSFER, {
        periodAmount: "1000",
        periodDuration: 86400,
      }),
      true,
    );
  });

  it("accepts ownership transfer without newOwner", () => {
    assert.equal(
      validateKitScopeRequest(OWNERSHIP_TRANSFER, { contractAddress: contract }),
      true,
    );
  });

  it("accepts native streaming", () => {
    assert.equal(
      validateKitScopeRequest(NATIVE_STREAMING, {
        initialAmount: "0",
        maxAmount: "1000",
        amountPerSecond: "10",
      }),
      true,
    );
  });
});

describe("kit scope grant validation (UI parity)", () => {
  it("accepts erc20 transfer with allowedTargets caveat shape", () => {
    assert.equal(
      validateKitScopeRequest(ERC20_TRANSFER_AMOUNT, {
        tokenAddress: token,
        maxAmount: "1000",
      }),
      true,
    );
  });

  it("rejects function-call with empty selectors", () => {
    assert.equal(
      validateKitScopeRequest(FUNCTION_CALL, {
        targets: [target],
        selectors: [],
      }),
      false,
    );
  });
});
