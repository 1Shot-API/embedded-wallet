export type SignMode = "message" | "typedData";

export const DEFAULT_EIP712_TYPED_DATA = {
  domain: {
    name: "Ether Mail",
    version: "1",
    chainId: 421614,
    verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
  },
  types: {
    Person: [
      { name: "name", type: "string" },
      { name: "wallet", type: "address" },
    ],
    Mail: [
      { name: "from", type: "Person" },
      { name: "to", type: "Person" },
      { name: "contents", type: "string" },
    ],
  },
  primaryType: "Mail",
  message: {
    from: {
      name: "Cow",
      wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
    },
    to: {
      name: "Bob",
      wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
    },
    contents: "Hello, Bob!",
  },
} as const;

export const DEFAULT_TYPED_DATA_JSON = JSON.stringify(
  DEFAULT_EIP712_TYPED_DATA,
  null,
  2,
);

export function parseTypedDataJson(json: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid typed data JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Typed data must be a JSON object.");
  }
  const record = parsed as Record<string, unknown>;
  for (const key of ["domain", "types", "primaryType", "message"] as const) {
    if (!(key in record)) {
      throw new Error(`Typed data is missing required field "${key}".`);
    }
  }
  return record;
}
