import {
  EVMAccountAddressSchema,
  EVMChainId,
  HexStringSchema,
  type EVMAccountAddress,
  type HexString,
} from "@1shotapi/ows-types";
import { z } from "zod";

import { WALLET_CALLS_VERSION } from "./constants";

/**
 * EIP-5792 chain id: `0x` + hex with no leading zeros (`0x0` only for zero).
 * `"0x01"` is invalid params.
 */
export const strictHexChainIdSchema = z
  .string()
  .regex(/^0x(0|[1-9a-fA-F][0-9a-fA-F]*)$/, {
    message: "chainId must be 0x-prefixed hex with no leading zeros",
  })
  .transform((value) =>
    EVMChainId(`0x${BigInt(value).toString(16)}` as `0x${string}`),
  );

const walletCallCapabilitySchema = z
  .object({
    optional: z.boolean().optional(),
  })
  .catchall(z.unknown());

export type IParsedWalletCapability = z.infer<typeof walletCallCapabilitySchema>;

const walletCallSchema = z.strictObject({
  to: EVMAccountAddressSchema,
  data: HexStringSchema.optional(),
  value: HexStringSchema.optional(),
  capabilities: z.record(z.string(), walletCallCapabilitySchema).optional(),
});

export type IParsedWalletCall = {
  to: EVMAccountAddress;
  data?: HexString;
  value?: HexString;
  capabilities?: Record<string, IParsedWalletCapability>;
};

export const sendCallsParamsSchema = z.tuple([
  z.strictObject({
    version: z.literal(WALLET_CALLS_VERSION),
    id: z.string().min(1).max(8194).optional(),
    from: EVMAccountAddressSchema.optional(),
    chainId: strictHexChainIdSchema,
    atomicRequired: z.boolean(),
    calls: z.array(walletCallSchema).min(1),
    capabilities: z.record(z.string(), walletCallCapabilitySchema).optional(),
  }),
]);

export type IParsedSendCallsParams = {
  version: typeof WALLET_CALLS_VERSION;
  id?: string;
  from?: EVMAccountAddress;
  chainId: EVMChainId;
  atomicRequired: boolean;
  calls: IParsedWalletCall[];
  capabilities?: Record<string, IParsedWalletCapability>;
};

export const callsBundleIdSchema = z.tuple([z.string().min(1).max(8194)]);

export const getCapabilitiesParamsSchema = z.union([
  z.tuple([]),
  z.tuple([EVMAccountAddressSchema]),
  z.tuple([EVMAccountAddressSchema, z.array(strictHexChainIdSchema)]),
]);

/** First capability name that the wallet must reject, if any. */
export function unsupportedCapabilityName(
  capabilities: Record<string, { optional?: boolean } | undefined> | undefined,
): string | undefined {
  if (!capabilities) return undefined;
  for (const [name, value] of Object.entries(capabilities)) {
    if (value?.optional === true) continue;
    return name;
  }
  return undefined;
}

export function randomBundleId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}
