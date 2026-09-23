import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDelegation, getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";
import { getAddress } from "viem";
import type { IAppendedCaveatConfiguration } from "@1shotapi/ows-types";
import { buildAppendedCaveatBuilder } from "@/lib/implementations/business/DelegationService.ts";
import {
  buildKitScopeAttenuatedPermission,
  buildKitScopeConfig,
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
const delegate = "0x" + "d".repeat(40);
const delegator = "0x" + "e".repeat(40);

const environment = getSmartAccountsEnvironment(8453);

const appendedTarget: IAppendedCaveatConfiguration[] = [
  {
    type: "allowedTargets",
    data: { targets: [target] },
  },
];

function permissionDataForType(type: string): Record<string, unknown> {
  switch (type) {
    case ERC20_TRANSFER_AMOUNT:
      return { tokenAddress: token, maxAmount: "1000" };
    case ERC20_STREAMING:
      return {
        tokenAddress: token,
        initialAmount: "0",
        maxAmount: "1000",
        amountPerSecond: "10",
        startTime: 1_700_000_000,
      };
    case NATIVE_TRANSFER_AMOUNT:
      return { maxAmount: "1000" };
    case NATIVE_STREAMING:
      return {
        initialAmount: "0",
        maxAmount: "1000",
        amountPerSecond: "10",
        startTime: 1_700_000_000,
      };
    case NATIVE_PERIOD_TRANSFER:
      return { periodAmount: "1000", periodDuration: 86400 };
    case ERC721_TRANSFER:
      return { tokenAddress: token, tokenId: "42" };
    case OWNERSHIP_TRANSFER:
      return { contractAddress: contract };
    case FUNCTION_CALL:
      return {
        targets: [target],
        selectors: ["0x12345678"],
        maxValue: "0",
      };
    default:
      throw new Error(`unexpected type ${type}`);
  }
}

const KIT_SCOPE_TYPES = [
  ERC20_TRANSFER_AMOUNT,
  ERC20_STREAMING,
  NATIVE_TRANSFER_AMOUNT,
  NATIVE_STREAMING,
  NATIVE_PERIOD_TRANSFER,
  ERC721_TRANSFER,
  OWNERSHIP_TRANSFER,
  FUNCTION_CALL,
] as const;

function assertAttenuatedScopeFields(
  permissionType: (typeof KIT_SCOPE_TYPES)[number],
  data: Record<string, unknown>,
): void {
  switch (permissionType) {
    case ERC20_TRANSFER_AMOUNT:
      assert.equal(data.maxAmount, "0x3e8");
      assert.equal(data.tokenAddress, getAddress(token));
      break;
    case ERC20_STREAMING:
      assert.equal(data.maxAmount, "0x3e8");
      assert.equal(data.amountPerSecond, "0xa");
      assert.equal(data.tokenAddress, getAddress(token));
      break;
    case NATIVE_TRANSFER_AMOUNT:
      assert.equal(data.maxAmount, "0x3e8");
      break;
    case NATIVE_STREAMING:
      assert.equal(data.maxAmount, "0x3e8");
      assert.equal(data.amountPerSecond, "0xa");
      break;
    case NATIVE_PERIOD_TRANSFER:
      assert.equal(data.periodAmount, "0x3e8");
      assert.equal(data.periodDuration, 86400);
      break;
    case ERC721_TRANSFER:
      assert.equal(data.tokenId, "0x2a");
      assert.equal(data.tokenAddress, getAddress(token));
      break;
    case OWNERSHIP_TRANSFER:
      assert.equal(data.contractAddress, getAddress(contract));
      break;
    case FUNCTION_CALL:
      assert.deepEqual(data.targets, [getAddress(target)]);
      assert.equal(data.maxValue, "0x0");
      break;
    default:
      throw new Error(`unexpected type ${permissionType}`);
  }
}

describe("kit scope delegation build (DelegationService path)", () => {
  for (const permissionType of KIT_SCOPE_TYPES) {
    it(`createDelegation merges scope + appended caveats for ${permissionType}`, () => {
      const permission = {
        type: permissionType,
        isAdjustmentAllowed: false,
        data: permissionDataForType(permissionType),
      };
      const scope = buildKitScopeConfig(permission);
      const appended = buildAppendedCaveatBuilder(environment, appendedTarget);
      const withoutAppend = buildAppendedCaveatBuilder(environment, undefined);
      const delegation = createDelegation({
        to: delegate,
        from: delegator,
        environment,
        salt: "0x01",
        scope,
        caveats: appended,
      });
      const scopeOnly = createDelegation({
        to: delegate,
        from: delegator,
        environment,
        salt: "0x01",
        scope,
        caveats: withoutAppend,
      });
      assert.ok(scopeOnly.caveats.length > 0);
      assert.equal(
        delegation.caveats.length,
        scopeOnly.caveats.length + 1,
      );
    });
  }
});

describe("buildKitScopeAttenuatedPermission (all kit scopes)", () => {
  for (const permissionType of KIT_SCOPE_TYPES) {
    it(`preserves scope fields and echoes caveats for ${permissionType}`, () => {
      const permission = {
        type: permissionType,
        isAdjustmentAllowed: false,
        data: permissionDataForType(permissionType),
      };
      const result = buildKitScopeAttenuatedPermission(permission, appendedTarget);
      assert.equal(result.type, permissionType);
      const data = result.data as Record<string, unknown>;
      assertAttenuatedScopeFields(permissionType, data);
      assert.ok(Array.isArray(data.caveats));
      assert.equal((data.caveats as unknown[]).length, 1);
    });
  }
});
