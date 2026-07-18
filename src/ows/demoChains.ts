import { EVMChainId } from "@1shotapi/ows-types";

/** Demo chains for the branding-layer chain dropdown (fed into RpcHelper). */
export const DEMO_CHAINS: ReadonlyArray<{
  chainId: EVMChainId;
  label: string;
  rpcUrl: string;
  /** Base URL for tx/address explorer links (no trailing slash). */
  blockExplorerUrl: string;
}> = [
  {
    chainId: EVMChainId("0x4cef52"), // 5042002
    label: "Arc Testnet",
    rpcUrl: "https://arc-testnet.g.alchemy.com/v2/jqLUTbHeN_cVsIX2W7tJk",
    blockExplorerUrl: "https://testnet.arcscan.app",
  },
  {
    chainId: EVMChainId("0xaa36a7"), // 11155111
    label: "Sepolia",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/jqLUTbHeN_cVsIX2W7tJk",
    blockExplorerUrl: "https://sepolia.etherscan.io",
  },
  {
    chainId: EVMChainId("0x14a34"), // 84532
    label: "Base Sepolia",
    rpcUrl: "https://base-sepolia.g.alchemy.com/v2/jqLUTbHeN_cVsIX2W7tJk",
    blockExplorerUrl: "https://sepolia.basescan.org",
  },
  {
    chainId: EVMChainId("0x2105"), // 8453
    label: "Base",
    rpcUrl: "https://base-mainnet.g.alchemy.com/v2/jqLUTbHeN_cVsIX2W7tJk",
    blockExplorerUrl: "https://basescan.org",
  },
];
