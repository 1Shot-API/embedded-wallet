export type SignMode = "message" | "typedData";

export const DEMO_EIP712_DOMAIN_NAME = "Ether Mail";

const DEMO_EIP712_DOMAIN_BASE = {
  name: DEMO_EIP712_DOMAIN_NAME,
  version: "1",
  verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
} as const;

const DEMO_EIP712_TYPED_DATA_BODY = {
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

export function hostEvmChainIdDecimal(chainIdHex: string): number | null {
  if (!chainIdHex.startsWith("0x")) {
    return null;
  }
  return Number(BigInt(chainIdHex));
}

export function buildDefaultEip712TypedData(chainIdHex: string): Record<
  string,
  unknown
> {
  const chainId = hostEvmChainIdDecimal(chainIdHex);
  if (chainId === null) {
    throw new Error("EIP-712 demo requires an EVM chain id.");
  }
  return {
    domain: { ...DEMO_EIP712_DOMAIN_BASE, chainId },
    ...DEMO_EIP712_TYPED_DATA_BODY,
  };
}

export function defaultTypedDataJsonForChain(chainIdHex: string): string {
  return JSON.stringify(buildDefaultEip712TypedData(chainIdHex), null, 2);
}

export function isDemoEip712TypedData(record: Record<string, unknown>): boolean {
  const domain = record.domain;
  if (!domain || typeof domain !== "object" || Array.isArray(domain)) {
    return false;
  }
  return (domain as Record<string, unknown>).name === DEMO_EIP712_DOMAIN_NAME;
}

/** Keep demo typed data (Ether Mail, Permit2) in sync with the host chain. */
export function syncDemoTypedDataChainId(
  json: string,
  chainIdHex: string,
  permit2Token?: string,
): string {
  const chainId = hostEvmChainIdDecimal(chainIdHex);
  if (chainId === null) {
    return json;
  }
  try {
    const parsed = parseTypedDataJson(json);
    if (isPermit2DemoTypedData(parsed)) {
      // The token is per-chain, so rebuild the preset rather than patching chainId.
      const domain = parsed.domain as Record<string, unknown>;
      return domain.chainId === chainId
        ? json
        : permit2TypedDataJsonForChain(chainIdHex, permit2Token);
    }
    if (!isDemoEip712TypedData(parsed)) {
      return json;
    }
    const domain = parsed.domain as Record<string, unknown>;
    if (domain.chainId === chainId) {
      return json;
    }
    return JSON.stringify(
      { ...parsed, domain: { ...domain, chainId } },
      null,
      2,
    );
  } catch {
    return json;
  }
}

/** Uniswap Permit2 — same address on every chain it is deployed to. */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
export const PERMIT2_DOMAIN_NAME = "Permit2";
/** Demo spender for the Permit2 preset (Uniswap Universal Router on Ethereum). */
const PERMIT2_DEMO_SPENDER = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";
/** Fallback token when the session chain has no catalog USDC. */
const PERMIT2_FALLBACK_TOKEN = "0x0000000000000000000000000000000000000001";

/**
 * Permit2 `PermitSingle` typed data. Unlike the Ether Mail demo, this one is in the ERC-7730
 * clear-signing registry (`registry/uniswap/eip712-uniswap-permit2.json`, deployed on Sepolia,
 * Base Sepolia, Arc Testnet and most mainnets), so the wallet renders the clear-signing view.
 */
export function buildPermit2TypedData(
  chainIdHex: string,
  token: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): Record<string, unknown> {
  const chainId = hostEvmChainIdDecimal(chainIdHex);
  if (chainId === null) {
    throw new Error("Permit2 demo requires an EVM chain id.");
  }
  return {
    domain: {
      name: PERMIT2_DOMAIN_NAME,
      chainId,
      verifyingContract: PERMIT2_ADDRESS,
    },
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      PermitSingle: [
        { name: "details", type: "PermitDetails" },
        { name: "spender", type: "address" },
        { name: "sigDeadline", type: "uint256" },
      ],
      PermitDetails: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint160" },
        { name: "expiration", type: "uint48" },
        { name: "nonce", type: "uint48" },
      ],
    },
    primaryType: "PermitSingle",
    message: {
      details: {
        token: token || PERMIT2_FALLBACK_TOKEN,
        amount: "1000000",
        expiration: String(nowSeconds + 30 * 24 * 60 * 60),
        nonce: "0",
      },
      spender: PERMIT2_DEMO_SPENDER,
      sigDeadline: String(nowSeconds + 30 * 60),
    },
  };
}

export function permit2TypedDataJsonForChain(
  chainIdHex: string,
  token: string | undefined,
): string {
  return JSON.stringify(buildPermit2TypedData(chainIdHex, token), null, 2);
}

function isPermit2DemoTypedData(record: Record<string, unknown>): boolean {
  const domain = record.domain;
  if (!domain || typeof domain !== "object" || Array.isArray(domain)) {
    return false;
  }
  return (domain as Record<string, unknown>).name === PERMIT2_DOMAIN_NAME;
}

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

export interface ISiwsMessageParams {
  domain: string;
  address: string;
  uri: string;
  /** CAIP-2 Solana chain id, e.g. `solana:mainnet`. */
  chainId: string;
  nonce: string;
  statement?: string;
  version?: string;
  issuedAt?: string;
}

/** SIWS-shaped text for the message box (Phase 5 wires `solana:signIn`). */
export function buildSiwsPersonalMessage(params: ISiwsMessageParams): string {
  const version = params.version ?? "1";
  const issuedAt = params.issuedAt ?? new Date().toISOString();
  const statement =
    params.statement ?? "Sign in with Solana to the host playground.";
  return [
    `${params.domain} wants you to sign in with your Solana account:`,
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
