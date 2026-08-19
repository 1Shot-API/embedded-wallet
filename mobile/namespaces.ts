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
  accounts?: string[];
  methods?: string[];
  events?: string[];
};

export type ApprovedEip155Namespace = {
  chains: string[];
  accounts: string[];
  methods: string[];
  events: string[];
};

/** WalletConnect `getSdkError` keys for an unsatisfiable session proposal. */
export type NamespaceApprovalSdkError =
  | "UNSUPPORTED_CHAINS"
  | "UNSUPPORTED_METHODS"
  | "UNSUPPORTED_EVENTS"
  | "UNSUPPORTED_NAMESPACE_KEY";

export class NamespaceApprovalError extends Error {
  constructor(
    message: string,
    public readonly sdkError: NamespaceApprovalSdkError,
  ) {
    super(message);
    this.name = "NamespaceApprovalError";
  }
}

const EIP155_CHAIN_RE = /^eip155:\d+$/;

function isEip155NamespaceKey(key: string): boolean {
  return key === "eip155" || EIP155_CHAIN_RE.test(key);
}

function eip155ChainsFrom(key: string, ns: NamespaceInput): string[] {
  const chains: string[] = [];
  if (EIP155_CHAIN_RE.test(key)) {
    chains.push(key);
  }
  for (const chain of ns.chains ?? []) {
    if (EIP155_CHAIN_RE.test(chain)) {
      chains.push(chain);
    }
  }
  for (const account of ns.accounts ?? []) {
    const match = /^(eip155:\d+):/u.exec(account);
    if (match) {
      chains.push(match[1]);
    }
  }
  return chains;
}

function collectEip155(
  namespaces: Record<string, NamespaceInput>,
  options: { required: boolean },
): {
  chains: Set<string>;
  methods: Set<string>;
  events: Set<string>;
} {
  const chains = new Set<string>();
  const methods = new Set<string>();
  const events = new Set<string>();
  for (const [key, ns] of Object.entries(namespaces)) {
    if (!isEip155NamespaceKey(key)) {
      if (options.required) {
        throw new NamespaceApprovalError(
          `Required namespace ${key} is not supported`,
          "UNSUPPORTED_NAMESPACE_KEY",
        );
      }
      continue;
    }
    for (const chain of eip155ChainsFrom(key, ns)) {
      chains.add(chain);
    }
    for (const method of ns.methods ?? []) {
      methods.add(method);
    }
    for (const event of ns.events ?? []) {
      events.add(event);
    }
  }
  return { chains, methods, events };
}

/**
 * Build approved EIP-155 namespaces from a session proposal ∩ wallet support.
 * Required namespaces must be fully satisfiable; optional non-eip155 keys and
 * unsupported optional chains/methods/events are dropped. Throws
 * {@link NamespaceApprovalError} instead of approving a mismatched session.
 */
export function buildApprovedNamespaces(params: {
  requiredNamespaces?: Record<string, NamespaceInput>;
  optionalNamespaces?: Record<string, NamespaceInput>;
  address: string;
}): Record<string, ApprovedEip155Namespace> {
  const walletChains = new Set(supportedCaip2Chains());
  const walletMethods = new Set<string>(EIP155_METHODS);
  const walletEvents = new Set<string>(EIP155_EVENTS);

  const required = collectEip155(params.requiredNamespaces ?? {}, {
    required: true,
  });
  const optional = collectEip155(params.optionalNamespaces ?? {}, {
    required: false,
  });

  for (const chain of required.chains) {
    if (!walletChains.has(chain)) {
      throw new NamespaceApprovalError(
        `Required chain ${chain} is not supported`,
        "UNSUPPORTED_CHAINS",
      );
    }
  }
  for (const method of required.methods) {
    if (!walletMethods.has(method)) {
      throw new NamespaceApprovalError(
        `Required method ${method} is not supported`,
        "UNSUPPORTED_METHODS",
      );
    }
  }
  for (const event of required.events) {
    if (!walletEvents.has(event)) {
      throw new NamespaceApprovalError(
        `Required event ${event} is not supported`,
        "UNSUPPORTED_EVENTS",
      );
    }
  }

  const chains = new Set<string>(required.chains);
  for (const chain of optional.chains) {
    if (walletChains.has(chain)) {
      chains.add(chain);
    }
  }
  if (chains.size === 0) {
    throw new NamespaceApprovalError(
      "Proposal has no supported eip155 chains",
      "UNSUPPORTED_CHAINS",
    );
  }

  const methods = new Set<string>(required.methods);
  for (const method of optional.methods) {
    if (walletMethods.has(method)) {
      methods.add(method);
    }
  }
  const events = new Set<string>(required.events);
  for (const event of optional.events) {
    if (walletEvents.has(event)) {
      events.add(event);
    }
  }
  if (methods.size === 0) {
    for (const method of EIP155_METHODS) {
      methods.add(method);
    }
  }
  if (events.size === 0) {
    for (const event of EIP155_EVENTS) {
      events.add(event);
    }
  }

  const chainList = [...chains];
  return {
    eip155: {
      chains: chainList,
      accounts: chainList.map((chain) => {
        const decimal = Number(chain.slice("eip155:".length));
        return caip10Account(decimal, params.address);
      }),
      methods: [...methods],
      events: [...events],
    },
  };
}
