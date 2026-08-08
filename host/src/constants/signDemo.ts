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

export interface ISiweMessageParams {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
  statement?: string;
  version?: string;
  issuedAt?: string;
}

/** Classic EIP-4361 SIWE text for `personal_sign`. */
export function buildSiwePersonalMessage(params: ISiweMessageParams): string {
  const version = params.version ?? "1";
  const issuedAt = params.issuedAt ?? new Date().toISOString();
  const statement =
    params.statement ?? "Sign in with Ethereum to the host playground.";
  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    "",
    statement,
    "",
    `URI: ${params.uri}`,
    `Version: ${version}`,
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

/** EIP-712 SignInWithEthereum typed data for `eth_signTypedData_v4`. */
export function buildSiweTypedData(
  params: ISiweMessageParams,
): Record<string, unknown> {
  const version = params.version ?? "1";
  const issuedAt = params.issuedAt ?? new Date().toISOString();
  const statement =
    params.statement ?? "Sign in with Ethereum to the host playground.";
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
      SignInWithEthereum: [
        { name: "domain", type: "string" },
        { name: "address", type: "address" },
        { name: "statement", type: "string" },
        { name: "uri", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "nonce", type: "string" },
        { name: "issuedAt", type: "string" },
      ],
    },
    primaryType: "SignInWithEthereum",
    domain: {
      name: params.domain,
      version,
      chainId: params.chainId,
    },
    message: {
      domain: params.domain,
      address: params.address,
      statement,
      uri: params.uri,
      version,
      chainId: params.chainId,
      nonce: params.nonce,
      issuedAt,
    },
  };
}

export function randomSiweNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

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
