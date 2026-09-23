import type { IAppendedCaveatConfiguration, IExecutionPermission } from "@1shotapi/ows-types";
import { EVMAccountAddress } from "@1shotapi/ows-types";
import {
  createDelegation,
  ScopeType,
} from "@metamask/smart-accounts-kit";
import { getAddress, isHex, type Hex } from "viem";
import {
  ERC20_STREAMING,
  ERC20_TRANSFER_AMOUNT,
  ERC20_TOKEN_PERIODIC,
  ERC721_TRANSFER,
  FUNCTION_CALL,
  NATIVE_PERIOD_TRANSFER,
  NATIVE_STREAMING,
  NATIVE_TRANSFER_AMOUNT,
  OWNERSHIP_TRANSFER,
} from "../../interfaces/business/IDelegationService";
import type { GrantPermissionModalKind } from "../../../wallet/modalTypes";
export function grantKindForPermissionType(
  permissionType: string,
): GrantPermissionModalKind | null {
  switch (permissionType) {
    case ERC20_TOKEN_PERIODIC:
      return "grantExecutionPermission";
    case ERC20_TRANSFER_AMOUNT:
      return "grantErc20TransferPermission";
    case ERC20_STREAMING:
      return "grantErc20StreamingPermission";
    case NATIVE_TRANSFER_AMOUNT:
      return "grantNativeTransferPermission";
    case NATIVE_STREAMING:
      return "grantNativeStreamingPermission";
    case NATIVE_PERIOD_TRANSFER:
      return "grantNativePeriodTransferPermission";
    case ERC721_TRANSFER:
      return "grantErc721TransferPermission";
    case OWNERSHIP_TRANSFER:
      return "grantOwnershipTransferPermission";
    case FUNCTION_CALL:
      return "grantFunctionCallPermission";
    default:
      return null;
  }
}

function requireAddress(value: unknown, field: string): EVMAccountAddress {
  if (typeof value !== "string") {
    throw new Error(`${field} is required`);
  }
  return EVMAccountAddress(getAddress(value as `0x${string}`));
}

function toBigIntAmount(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(value);
  if (typeof value === "string" && value.trim() !== "") {
    const trimmed = value.trim();
    if (trimmed.startsWith("0x")) return BigInt(trimmed);
    return BigInt(trimmed);
  }
  throw new Error(`${field} is required`);
}

function toNumberField(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  throw new Error(`${field} is required`);
}

function optionalStartUnix(data: Record<string, unknown>): number | undefined {
  const startRaw = data.startDate ?? data.startTime ?? data.start;
  if (typeof startRaw === "number" && Number.isFinite(startRaw)) return startRaw;
  if (typeof startRaw === "string" && /^\d+$/.test(startRaw.trim())) {
    return Number(startRaw.trim());
  }
  return undefined;
}

function parseAllowedCalldataScope(
  data: Record<string, unknown>,
): { startIndex: number; value: Hex }[] | undefined {
  const raw = data.allowedCalldata;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`allowedCalldata[${index}] must be an object`);
    }
    const row = entry as Record<string, unknown>;
    const startIndex = toNumberField(row.startIndex, `allowedCalldata[${index}].startIndex`);
    const value = row.value;
    if (typeof value !== "string" || !isHex(value)) {
      throw new Error(`allowedCalldata[${index}].value must be hex`);
    }
    return { startIndex, value: value as Hex };
  });
}

function parseExactCalldataScope(
  data: Record<string, unknown>,
): { calldata: Hex } | undefined {
  const raw = data.exactCalldata;
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string") {
    if (!isHex(raw)) throw new Error("exactCalldata must be hex");
    return { calldata: raw as Hex };
  }
  if (typeof raw === "object" && raw !== null) {
    const calldata = (raw as Record<string, unknown>).calldata;
    if (typeof calldata !== "string" || !isHex(calldata)) {
      throw new Error("exactCalldata.calldata must be hex");
    }
    return { calldata: calldata as Hex };
  }
  throw new Error("exactCalldata must be hex or { calldata }");
}

function appendCalldataToScope<T extends Record<string, unknown>>(
  scope: T,
  data: Record<string, unknown>,
): T & {
  allowedCalldata?: { startIndex: number; value: Hex }[];
  exactCalldata?: { calldata: Hex };
} {
  const allowedCalldata = parseAllowedCalldataScope(data);
  const exactCalldata = parseExactCalldataScope(data);
  if (allowedCalldata && exactCalldata) {
    throw new Error("Cannot specify both allowedCalldata and exactCalldata on scope data");
  }
  return {
    ...scope,
    ...(allowedCalldata ? { allowedCalldata } : {}),
    ...(exactCalldata ? { exactCalldata } : {}),
  };
}

export function parseErc20TransferAmountData(data: Record<string, unknown>) {
  return {
    tokenAddress: requireAddress(
      data.tokenAddress ?? data.token,
      "tokenAddress",
    ),
    maxAmount: toBigIntAmount(data.maxAmount ?? data.amount, "maxAmount"),
  };
}

export function parseErc20StreamingData(data: Record<string, unknown>) {
  return {
    tokenAddress: requireAddress(
      data.tokenAddress ?? data.token,
      "tokenAddress",
    ),
    initialAmount: toBigIntAmount(data.initialAmount, "initialAmount"),
    maxAmount: toBigIntAmount(data.maxAmount, "maxAmount"),
    amountPerSecond: toBigIntAmount(data.amountPerSecond, "amountPerSecond"),
    startTime: optionalStartUnix(data) ?? Math.floor(Date.now() / 1000),
  };
}

export function parseNativeTransferAmountData(data: Record<string, unknown>) {
  return {
    maxAmount: toBigIntAmount(data.maxAmount ?? data.amount, "maxAmount"),
    scopeCalldata: data,
  };
}

export function parseNativeStreamingData(data: Record<string, unknown>) {
  return {
    initialAmount: toBigIntAmount(data.initialAmount, "initialAmount"),
    maxAmount: toBigIntAmount(data.maxAmount, "maxAmount"),
    amountPerSecond: toBigIntAmount(data.amountPerSecond, "amountPerSecond"),
    startTime: optionalStartUnix(data) ?? Math.floor(Date.now() / 1000),
    scopeCalldata: data,
  };
}

export function parseNativePeriodTransferData(data: Record<string, unknown>) {
  const durationRaw = data.periodDuration ?? data.period ?? data.duration;
  return {
    periodAmount: toBigIntAmount(data.periodAmount ?? data.amount, "periodAmount"),
    periodDuration: toNumberField(durationRaw, "periodDuration"),
    startDate: optionalStartUnix(data) ?? Math.floor(Date.now() / 1000),
    scopeCalldata: data,
  };
}

export function parseErc721TransferData(data: Record<string, unknown>) {
  return {
    tokenAddress: requireAddress(
      data.tokenAddress ?? data.contractAddress,
      "tokenAddress",
    ),
    tokenId: toBigIntAmount(data.tokenId, "tokenId"),
  };
}

export function parseOwnershipTransferData(data: Record<string, unknown>) {
  return {
    contractAddress: requireAddress(
      data.contractAddress ?? data.target,
      "contractAddress",
    ),
    newOwner: typeof data.newOwner === "string" ? data.newOwner : undefined,
  };
}

export function parseFunctionCallData(data: Record<string, unknown>) {
  const targets = readHexAddressArray(data, "targets");
  const selectors = readSelectorArray(data, "selectors");
  const maxValueRaw = data.maxValue ?? data.valueLte;
  return {
    targets,
    selectors,
    maxValue:
      maxValueRaw === undefined || maxValueRaw === null
        ? 0n
        : toBigIntAmount(maxValueRaw, "maxValue"),
    allowedCalldata: parseAllowedCalldataScope(data),
    exactCalldata: parseExactCalldataScope(data),
  };
}

function readHexAddressArray(
  data: Record<string, unknown>,
  key: string,
): `0x${string}`[] {
  const raw = data[key];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${key} must be a non-empty array`);
  }
  return raw.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`${key}[${index}] must be an address`);
    }
    return getAddress(entry as `0x${string}`);
  });
}

function readSelectorArray(
  data: Record<string, unknown>,
  key: string,
): Hex[] {
  const raw = data[key] ?? data.methods;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${key} must be a non-empty array`);
  }
  return raw.map((entry, index) => {
    if (typeof entry !== "string" || !entry.startsWith("0x")) {
      throw new Error(`${key}[${index}] must be a hex selector`);
    }
    return entry as Hex;
  });
}

type KitScopeConfig = NonNullable<
  Extract<Parameters<typeof createDelegation>[0], { scope: unknown }>["scope"]
>;

function echoScopeCalldataFromData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const allowedCalldata = parseAllowedCalldataScope(data);
  const exactCalldata = parseExactCalldataScope(data);
  if (allowedCalldata && exactCalldata) {
    throw new Error(
      "Cannot specify both allowedCalldata and exactCalldata on scope data",
    );
  }
  return {
    ...(allowedCalldata?.length ? { allowedCalldata } : {}),
    ...(exactCalldata ? { exactCalldata } : {}),
  };
}

export function buildKitScopeConfig(
  permission: IExecutionPermission,
): KitScopeConfig {
  const data = permission.data as Record<string, unknown>;
  switch (permission.type) {
    case ERC20_TRANSFER_AMOUNT: {
      const parsed = parseErc20TransferAmountData(data);
      return {
        type: ScopeType.Erc20TransferAmount,
        tokenAddress: getAddress(parsed.tokenAddress),
        maxAmount: parsed.maxAmount,
      };
    }
    case ERC20_STREAMING: {
      const parsed = parseErc20StreamingData(data);
      return {
        type: ScopeType.Erc20Streaming,
        tokenAddress: getAddress(parsed.tokenAddress),
        initialAmount: parsed.initialAmount,
        maxAmount: parsed.maxAmount,
        amountPerSecond: parsed.amountPerSecond,
        startTime: parsed.startTime,
      };
    }
    case NATIVE_TRANSFER_AMOUNT: {
      const parsed = parseNativeTransferAmountData(data);
      return appendCalldataToScope(
        {
          type: ScopeType.NativeTokenTransferAmount,
          maxAmount: parsed.maxAmount,
        },
        parsed.scopeCalldata,
      );
    }
    case NATIVE_STREAMING: {
      const parsed = parseNativeStreamingData(data);
      return appendCalldataToScope(
        {
          type: ScopeType.NativeTokenStreaming,
          initialAmount: parsed.initialAmount,
          maxAmount: parsed.maxAmount,
          amountPerSecond: parsed.amountPerSecond,
          startTime: parsed.startTime,
        },
        parsed.scopeCalldata,
      );
    }
    case NATIVE_PERIOD_TRANSFER: {
      const parsed = parseNativePeriodTransferData(data);
      return appendCalldataToScope(
        {
          type: ScopeType.NativeTokenPeriodTransfer,
          periodAmount: parsed.periodAmount,
          periodDuration: parsed.periodDuration,
          startDate: parsed.startDate,
        },
        parsed.scopeCalldata,
      );
    }
    case ERC721_TRANSFER: {
      const parsed = parseErc721TransferData(data);
      return {
        type: ScopeType.Erc721Transfer,
        tokenAddress: getAddress(parsed.tokenAddress),
        tokenId: parsed.tokenId,
      };
    }
    case OWNERSHIP_TRANSFER: {
      const parsed = parseOwnershipTransferData(data);
      return {
        type: ScopeType.OwnershipTransfer,
        contractAddress: getAddress(parsed.contractAddress),
      };
    }
    case FUNCTION_CALL: {
      const parsed = parseFunctionCallData(data);
      if (parsed.allowedCalldata && parsed.exactCalldata) {
        throw new Error("Cannot specify both allowedCalldata and exactCalldata");
      }
      return {
        type: ScopeType.FunctionCall,
        targets: parsed.targets,
        selectors: parsed.selectors,
        valueLte: { maxValue: parsed.maxValue },
        ...(parsed.allowedCalldata?.length
          ? { allowedCalldata: parsed.allowedCalldata }
          : {}),
        ...(parsed.exactCalldata ? { exactCalldata: parsed.exactCalldata } : {}),
      };
    }
    default:
      throw new Error(`Not a kit scope permission type: ${permission.type}`);
  }
}

function hexAmount(value: bigint): string {
  return `0x${value.toString(16)}`;
}

export function buildKitScopeAttenuatedPermission(
  permission: IExecutionPermission,
  caveats: IAppendedCaveatConfiguration[] | undefined,
): IExecutionPermission {
  const data = permission.data as Record<string, unknown>;
  let attenuatedData: Record<string, unknown>;

  switch (permission.type) {
    case ERC20_TRANSFER_AMOUNT: {
      const parsed = parseErc20TransferAmountData(data);
      attenuatedData = {
        tokenAddress: parsed.tokenAddress,
        maxAmount: hexAmount(parsed.maxAmount),
      };
      break;
    }
    case ERC20_STREAMING: {
      const parsed = parseErc20StreamingData(data);
      attenuatedData = {
        tokenAddress: parsed.tokenAddress,
        initialAmount: hexAmount(parsed.initialAmount),
        maxAmount: hexAmount(parsed.maxAmount),
        amountPerSecond: hexAmount(parsed.amountPerSecond),
        startTime: parsed.startTime,
      };
      break;
    }
    case NATIVE_TRANSFER_AMOUNT: {
      const parsed = parseNativeTransferAmountData(data);
      attenuatedData = {
        maxAmount: hexAmount(parsed.maxAmount),
        ...echoScopeCalldataFromData(parsed.scopeCalldata),
      };
      break;
    }
    case NATIVE_STREAMING: {
      const parsed = parseNativeStreamingData(data);
      attenuatedData = {
        initialAmount: hexAmount(parsed.initialAmount),
        maxAmount: hexAmount(parsed.maxAmount),
        amountPerSecond: hexAmount(parsed.amountPerSecond),
        startTime: parsed.startTime,
        ...echoScopeCalldataFromData(parsed.scopeCalldata),
      };
      break;
    }
    case NATIVE_PERIOD_TRANSFER: {
      const parsed = parseNativePeriodTransferData(data);
      attenuatedData = {
        periodAmount: hexAmount(parsed.periodAmount),
        periodDuration: parsed.periodDuration,
        startDate: parsed.startDate,
        ...echoScopeCalldataFromData(parsed.scopeCalldata),
      };
      break;
    }
    case ERC721_TRANSFER: {
      const parsed = parseErc721TransferData(data);
      attenuatedData = {
        tokenAddress: parsed.tokenAddress,
        tokenId: hexAmount(parsed.tokenId),
      };
      break;
    }
    case OWNERSHIP_TRANSFER: {
      const parsed = parseOwnershipTransferData(data);
      attenuatedData = {
        contractAddress: parsed.contractAddress,
        ...(parsed.newOwner ? { newOwner: parsed.newOwner } : {}),
      };
      break;
    }
    case FUNCTION_CALL: {
      const parsed = parseFunctionCallData(data);
      attenuatedData = {
        targets: parsed.targets,
        selectors: parsed.selectors,
        maxValue: hexAmount(parsed.maxValue),
        ...(parsed.allowedCalldata?.length
          ? { allowedCalldata: parsed.allowedCalldata }
          : {}),
        ...(parsed.exactCalldata ? { exactCalldata: parsed.exactCalldata } : {}),
      };
      break;
    }
    default:
      throw new Error(`Not a kit scope permission type: ${permission.type}`);
  }

  return {
    type: permission.type,
    isAdjustmentAllowed: permission.isAdjustmentAllowed,
    data: {
      ...attenuatedData,
      ...(caveats && caveats.length > 0 ? { caveats } : {}),
    },
  };
}

export function validateKitScopeRequest(
  permissionType: string,
  data: Record<string, unknown>,
): boolean {
  try {
    switch (permissionType) {
      case ERC20_TRANSFER_AMOUNT:
        parseErc20TransferAmountData(data);
        break;
      case ERC20_STREAMING:
        parseErc20StreamingData(data);
        break;
      case NATIVE_TRANSFER_AMOUNT:
        parseNativeTransferAmountData(data);
        break;
      case NATIVE_STREAMING:
        parseNativeStreamingData(data);
        break;
      case NATIVE_PERIOD_TRANSFER:
        parseNativePeriodTransferData(data);
        break;
      case ERC721_TRANSFER:
        parseErc721TransferData(data);
        break;
      case OWNERSHIP_TRANSFER:
        parseOwnershipTransferData(data);
        break;
      case FUNCTION_CALL:
        parseFunctionCallData(data);
        break;
      default:
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
