export const HOST_CHAINS = [
  {
    value: "0x13b2",
    label: "Arc",
    usdc: "0x3600000000000000000000000000000000000000",
    blockExplorerUrl: "https://explorer.arc.io",
  },
  {
    value: "0x4cef52",
    label: "Arc Testnet",
    usdc: "0x3600000000000000000000000000000000000000",
    tokenSymbol: "USDC",
    blockExplorerUrl: "https://testnet.arcscan.app",
  },
  {
    value: "0xaa36a7",
    label: "Sepolia",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    tokenSymbol: "USDC",
    blockExplorerUrl: "https://sepolia.etherscan.io",
  },
  {
    value: "0x14a34",
    label: "Base Sepolia",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    tokenSymbol: "USDC",
    blockExplorerUrl: "https://sepolia.basescan.org",
  },
  {
    value: "0x2105",
    label: "Base",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    tokenSymbol: "USDC",
    blockExplorerUrl: "https://basescan.org",
  },
  {
    value: "0x1237",
    label: "Robinhood",
    usdc: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    tokenSymbol: "USDG",
    blockExplorerUrl: "https://robinhoodchain.blockscout.com",
  },
] as const;

/** Focus demo: Arc mainnet USDC. */
export const FOCUS_USDC_ARC = {
  chainId: "0x13b2",
  assetAddress: "0x3600000000000000000000000000000000000000",
  label: "USDC (Arc)",
} as const;

/** Focus demo: Base mainnet USDT. */
export const FOCUS_USDT_BASE = {
  chainId: "0x2105",
  assetAddress: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
  label: "Tether (Base)",
} as const;

/**
 * Playground session / delegatee for `wallet_requestExecutionPermissions`.
 * Not a controlled key — only used to exercise the EIP-7715 grant UX.
 */
export const DEMO_EXECUTION_DELEGATEE =
  "0x1111111111111111111111111111111111111111" as const;

export type UsdcMode = "balance" | "send";

export function hostChainMeta(chainId: string) {
  return HOST_CHAINS.find((chain) => chain.value === chainId) ?? null;
}
