/**
 * EIP-155 chain ids (decimal) matching Branding HardcodedChainRepository catalog.
 * Keep in sync when the wallet catalog changes.
 */
export const SUPPORTED_EIP155_CHAIN_IDS: readonly number[] = [
  0x4cef52, // Arc Testnet
  0xaa36a7, // Sepolia
  0x14a34, // Base Sepolia
  0x1, // Ethereum
  0xe708, // Linea
  0xa4b1, // Arbitrum
  0xa, // Optimism
  0x38, // BSC
  0x2105, // Base
  0x89, // Polygon
  0x92, // Sonic
  0x82, // Unichain
  0x8f, // Monad
  0xa4ec, // Celo
  0x1237, // Robinhood
];

export const EIP155_METHODS = [
  "eth_accounts",
  "eth_requestAccounts",
  "eth_chainId",
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_sign",
  "personal_sign",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "wallet_switchEthereumChain",
  "wallet_getCapabilities",
] as const;

export const EIP155_EVENTS = ["accountsChanged", "chainChanged"] as const;

export function hexChainIdToDecimal(chainId: string): number {
  const normalized = chainId.trim().toLowerCase();
  if (normalized.startsWith("0x")) {
    return Number.parseInt(normalized, 16);
  }
  return Number.parseInt(normalized, 10);
}

export function caip2ChainId(decimalChainId: number): string {
  return `eip155:${decimalChainId}`;
}

export function caip10Account(decimalChainId: number, address: string): string {
  return `eip155:${decimalChainId}:${address}`;
}

export function supportedCaip2Chains(): string[] {
  return SUPPORTED_EIP155_CHAIN_IDS.map(caip2ChainId);
}

type NamespaceInput = {
  chains?: string[];
  methods?: string[];
  events?: string[];
};

/**
 * Build approved EIP-155 namespaces from a session proposal ∩ wallet support.
 */
export function buildApprovedNamespaces(params: {
  proposalNamespaces: Record<string, NamespaceInput>;
  address: string;
}): Record<
  string,
  {
    chains: string[];
    accounts: string[];
    methods: string[];
    events: string[];
  }
> {
  const { proposalNamespaces, address } = params;
  const walletChains = new Set(supportedCaip2Chains());

  const requestedChains = new Set<string>();
  for (const ns of Object.values(proposalNamespaces)) {
    for (const chain of ns.chains ?? []) {
      if (chain.startsWith("eip155:") && walletChains.has(chain)) {
        requestedChains.add(chain);
      }
    }
  }

  const chains =
    requestedChains.size > 0 ? [...requestedChains] : [...walletChains];

  const methods = new Set<string>(EIP155_METHODS);
  const events = new Set<string>(EIP155_EVENTS);
  for (const ns of Object.values(proposalNamespaces)) {
    for (const m of ns.methods ?? []) methods.add(m);
    for (const e of ns.events ?? []) events.add(e);
  }

  return {
    eip155: {
      chains,
      accounts: chains.map((chain) => {
        const decimal = Number(chain.slice("eip155:".length));
        return caip10Account(decimal, address);
      }),
      methods: [...methods],
      events: [...events],
    },
  };
}

/** Merge required + optional proposal namespaces into one map for approval. */
export function mergeProposalNamespaces(
  required: Record<string, NamespaceInput> = {},
  optional: Record<string, NamespaceInput> = {},
): Record<string, NamespaceInput> {
  const keys = new Set([...Object.keys(required), ...Object.keys(optional)]);
  const merged: Record<string, NamespaceInput> = {};
  for (const key of keys) {
    const req = required[key];
    const opt = optional[key];
    merged[key] = {
      chains: [...(req?.chains ?? []), ...(opt?.chains ?? [])],
      methods: [...(req?.methods ?? []), ...(opt?.methods ?? [])],
      events: [...(req?.events ?? []), ...(opt?.events ?? [])],
    };
  }
  return merged;
}
