import { EnableArcMainnet } from "../features";

export interface IHostChainMeta {
  value: string;
  label: string;
  usdc: string;
  tokenSymbol: string;
  blockExplorerUrl: string;
  isTestnet: boolean;
  /** Higher weight sorts above peers within the same network type. */
  weight: number;
}

const ARC_MAINNET: IHostChainMeta = {
  value: "0x13b2",
  label: "Arc",
  usdc: "0x3600000000000000000000000000000000000000",
  tokenSymbol: "USDC",
  blockExplorerUrl: "https://explorer.arc.io",
  isTestnet: false,
  weight: 100,
};

const ARC_TESTNET: IHostChainMeta = {
  value: "0x4cef52",
  label: "Arc Testnet",
  usdc: "0x3600000000000000000000000000000000000000",
  tokenSymbol: "USDC",
  blockExplorerUrl: "https://testnet.arcscan.app",
  isTestnet: true,
  weight: 100,
};

const HOST_CHAIN_SEED: readonly IHostChainMeta[] = [
  ...(EnableArcMainnet ? [ARC_MAINNET] : []),
  ARC_TESTNET,
  {
    value: "0xaa36a7",
    label: "Sepolia",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    tokenSymbol: "USDC",
    blockExplorerUrl: "https://sepolia.etherscan.io",
    isTestnet: true,
    weight: 80,
  },
  {
    value: "0x14a34",
    label: "Base Sepolia",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    tokenSymbol: "USDC",
    blockExplorerUrl: "https://sepolia.basescan.org",
    isTestnet: true,
    weight: 90,
  },
  {
    value: "0x2105",
    label: "Base",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    tokenSymbol: "USDC",
    blockExplorerUrl: "https://basescan.org",
    isTestnet: false,
    weight: 90,
  },
  {
    value: "0x1237",
    label: "Robinhood",
    usdc: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    tokenSymbol: "USDG",
    blockExplorerUrl: "https://robinhoodchain.blockscout.com",
    isTestnet: false,
    weight: 0,
  },
];

function compareHostChains(a: IHostChainMeta, b: IHostChainMeta): number {
  if (b.weight !== a.weight) return b.weight - a.weight;
  return a.label.localeCompare(b.label);
}

/** Mainnets first (weight/alpha), then testnets (weight/alpha). */
export const HOST_CHAINS: readonly IHostChainMeta[] = [
  ...HOST_CHAIN_SEED.filter((c) => !c.isTestnet).sort(compareHostChains),
  ...HOST_CHAIN_SEED.filter((c) => c.isTestnet).sort(compareHostChains),
];

/** Default session chain (Arc Testnet). */
export const DEFAULT_HOST_CHAIN_ID =
  HOST_CHAINS.find((chain) => chain.label === "Arc Testnet")?.value ??
  HOST_CHAINS.find((chain) => chain.isTestnet)?.value ??
  HOST_CHAINS[0]?.value ??
  "0x4cef52";

/** Focus demo: Arc USDC (mainnet when enabled, else testnet). */
export const FOCUS_USDC_ARC = EnableArcMainnet
  ? ({
      chainId: "0x13b2",
      assetAddress: "0x3600000000000000000000000000000000000000",
      label: "USDC (Arc)",
    } as const)
  : ({
      chainId: "0x4cef52",
      assetAddress: "0x3600000000000000000000000000000000000000",
      label: "USDC (Arc)",
    } as const);

/** Focus demo: Base mainnet USDT. */
export const FOCUS_USDT_BASE = {
  chainId: "0x2105",
  assetAddress: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
  label: "Tether (Base)",
} as const;

/** Default HTTPS icon for addAsset playground demos (Trust Wallet assets). */
export const DEMO_ADD_ASSET_ICON_URL =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png";

/**
 * Playground session / delegatee for `wallet_requestExecutionPermissions`.
 * Not a controlled key — only used to exercise the EIP-7715 grant UX.
 */
export const DEMO_EXECUTION_DELEGATEE =
  "0x1111111111111111111111111111111111111111" as const;

/** Base mainnet LiFi Diamond (common production address). */
export const DEMO_LIFI_DIAMOND_BASE =
  "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE" as const;

/** Base WETH — used as same-chain LiFi swap output in the playground. */
export const DEMO_WETH_BASE =
  "0x4200000000000000000000000000000000000006" as const;

/** Demo quote signer for LiFi playground grants (not a production key). */
export const DEMO_LIFI_QUOTE_SIGNER =
  "0x2222222222222222222222222222222222222222" as const;

export type UsdcMode = "balance" | "send";

export function hostChainMeta(chainId: string) {
  return HOST_CHAINS.find((chain) => chain.value === chainId) ?? null;
}
