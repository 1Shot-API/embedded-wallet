/**
 * CCTP bridge pre-fill options for the built-in host test panel.
 * Mirrors the website playground bridge controls (source / dest / amount / speed).
 */

export const BRIDGE_SESSION_SOURCE = "__session__";
export const BRIDGE_USER_PICKS_DEST = "__user_picks__";
export const BRIDGE_SPEED_UNSET = "__unset__";

export type BridgeSpeedOption = "fast" | "slow";

export type BridgeNetworkType = "mainnet" | "testnet";

export interface IBridgeChainOption {
  value: string;
  label: string;
  networkType: BridgeNetworkType;
  isSource: boolean;
  isDestination: boolean;
}

/** Chains usable as CCTP bridge sources / destinations in the host demo. */
const BRIDGE_CHAINS: readonly IBridgeChainOption[] = [
  {
    value: "0x4cef52",
    label: "Arc Testnet",
    networkType: "testnet",
    isSource: true,
    isDestination: true,
  },
  {
    value: "0xaa36a7",
    label: "Sepolia",
    networkType: "testnet",
    isSource: true,
    isDestination: true,
  },
  {
    value: "0x14a34",
    label: "Base Sepolia",
    networkType: "testnet",
    isSource: true,
    isDestination: true,
  },
  {
    value: "0x1",
    label: "Ethereum",
    networkType: "mainnet",
    isSource: true,
    isDestination: true,
  },
  {
    value: "0x2105",
    label: "Base",
    networkType: "mainnet",
    isSource: true,
    isDestination: true,
  },
  {
    value: "0xa4b1",
    label: "Arbitrum",
    networkType: "mainnet",
    isSource: true,
    isDestination: true,
  },
  {
    value: "0xa",
    label: "Optimism",
    networkType: "mainnet",
    isSource: true,
    isDestination: true,
  },
  {
    value: "0xe708",
    label: "Linea",
    networkType: "mainnet",
    isSource: true,
    isDestination: true,
  },
  {
    value: "0x89",
    label: "Polygon",
    networkType: "mainnet",
    isSource: true,
    isDestination: true,
  },
];

export const BRIDGE_SOURCE_CHAINS: readonly IBridgeChainOption[] =
  BRIDGE_CHAINS.filter((chain) => chain.isSource);

function findBridgeChain(hexChainId: string): IBridgeChainOption | null {
  const normalized = hexChainId.toLowerCase();
  return (
    BRIDGE_CHAINS.find((chain) => chain.value.toLowerCase() === normalized) ??
    null
  );
}

function resolveEffectiveSourceHex(
  sourceChainId: string,
  sessionChainId: string,
): string | null {
  const effective =
    sourceChainId === BRIDGE_SESSION_SOURCE ? sessionChainId : sourceChainId;
  const chain = findBridgeChain(effective);
  return chain?.isSource ? chain.value : null;
}

export function bridgeDestinationsForSource(
  sourceChainId: string,
  sessionChainId: string,
): readonly IBridgeChainOption[] {
  const sourceHex = resolveEffectiveSourceHex(sourceChainId, sessionChainId);
  if (!sourceHex) return [];
  const source = findBridgeChain(sourceHex);
  if (!source) return [];
  return BRIDGE_CHAINS.filter(
    (chain) =>
      chain.isDestination &&
      chain.networkType === source.networkType &&
      chain.value.toLowerCase() !== sourceHex.toLowerCase(),
  );
}

export function isBridgeAmountValid(amount: string): boolean {
  const trimmed = amount.trim();
  if (!trimmed) return true;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0;
}

export function chainIdToNumber(hexChainId: string): number {
  return Number.parseInt(hexChainId, 16);
}
