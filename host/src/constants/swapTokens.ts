import { hostChainMeta } from "@/components/hostChains";
import { LIFI_NATIVE_TOKEN } from "@/lib/lifiQuote";

export interface ISwapChain {
  value: string;
  label: string;
  logo: string;
  usdc: string;
  usdcSymbol: string;
  usdcDecimals: number;
  usdt?: string;
  usdtDecimals?: number;
  nativeSymbol: string;
  blockExplorerUrl: string;
}

/**
 * Mainnet networks available in the Swaps panel settings. Mirrors the website
 * playground catalog (`swapMainnetChains()`); logos are served from `public/`.
 */
export const SWAP_MAINNET_CHAINS: readonly ISwapChain[] = [
  {
    value: "0x13b2",
    label: "Arc",
    logo: "/images/logos/networks/Arc_network.png",
    usdc: "0x3600000000000000000000000000000000000000",
    usdcSymbol: "USDC",
    usdcDecimals: 6,
    nativeSymbol: "ETH",
    blockExplorerUrl: "https://explorer.arc.io",
  },
  {
    value: "0x2105",
    label: "Base",
    logo: "/images/logos/networks/coinbase-base-logo.png",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcSymbol: "USDC",
    usdcDecimals: 6,
    usdt: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
    usdtDecimals: 6,
    nativeSymbol: "ETH",
    blockExplorerUrl: "https://basescan.org",
  },
  {
    value: "0x1",
    label: "Ethereum",
    logo: "/images/logos/networks/ethereum-eth-logo.png",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdcSymbol: "USDC",
    usdcDecimals: 6,
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    usdtDecimals: 6,
    nativeSymbol: "ETH",
    blockExplorerUrl: "https://etherscan.io",
  },
  {
    value: "0xa4b1",
    label: "Arbitrum",
    logo: "/images/logos/networks/arbitrum-logo.png",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdcSymbol: "USDC",
    usdcDecimals: 6,
    usdt: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    usdtDecimals: 6,
    nativeSymbol: "ETH",
    blockExplorerUrl: "https://arbiscan.io",
  },
  {
    value: "0x38",
    label: "BSC",
    logo: "/images/logos/networks/binance-logo.png",
    usdc: "0x8AC76a51cc950d9822D68b83fe1Ad97B32Cd580d",
    usdcSymbol: "USDC",
    usdcDecimals: 18,
    usdt: "0x55d398326f99059fF775485246999027B3197955",
    usdtDecimals: 18,
    nativeSymbol: "BNB",
    blockExplorerUrl: "https://bscscan.com",
  },
  {
    value: "0xa4ec",
    label: "Celo",
    logo: "/images/logos/networks/celo-logo.png",
    usdc: "0xcebA9300f2b948710d2653dd7b07f33A8B32118C",
    usdcSymbol: "USDC",
    usdcDecimals: 6,
    usdt: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    usdtDecimals: 6,
    nativeSymbol: "CELO",
    blockExplorerUrl: "https://celoscan.io",
  },
  {
    value: "0xe708",
    label: "Linea",
    logo: "/images/logos/networks/linea-logo.png",
    usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    usdcSymbol: "USDC",
    usdcDecimals: 6,
    usdt: "0xA219439258ca9da29E9Cc4cE5596924745e12B93",
    usdtDecimals: 6,
    nativeSymbol: "ETH",
    blockExplorerUrl: "https://lineascan.build",
  },
  {
    value: "0x8f",
    label: "Monad",
    logo: "/images/logos/networks/monad-logo.png",
    usdc: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    usdcSymbol: "USDC",
    usdcDecimals: 6,
    usdt: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    usdtDecimals: 6,
    nativeSymbol: "MON",
    blockExplorerUrl: "https://monadvision.com",
  },
  {
    value: "0xa",
    label: "Optimism",
    logo: "/images/logos/networks/optimism-logo.png",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    usdcSymbol: "USDC",
    usdcDecimals: 6,
    usdt: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
    usdtDecimals: 6,
    nativeSymbol: "ETH",
    blockExplorerUrl: "https://optimistic.etherscan.io",
  },
  {
    value: "0x89",
    label: "Polygon",
    logo: "/images/logos/networks/polygon-logo.png",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    usdcSymbol: "USDC",
    usdcDecimals: 6,
    usdt: "0xc2132D05D31c914a87C6611C10748AeB04B58e8F",
    usdtDecimals: 6,
    nativeSymbol: "POL",
    blockExplorerUrl: "https://polygonscan.com",
  },
  {
    value: "0x1237",
    label: "Robinhood",
    logo: "/images/logos/networks/robinhood-logo.png",
    usdc: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    usdcSymbol: "USDG",
    usdcDecimals: 6,
    nativeSymbol: "ETH",
    blockExplorerUrl: "https://robinhoodchain.blockscout.com",
  },
  {
    value: "0x92",
    label: "Sonic",
    logo: "/images/logos/networks/Sonic-logo.jpg",
    usdc: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
    usdcSymbol: "USDC",
    usdcDecimals: 6,
    nativeSymbol: "S",
    blockExplorerUrl: "https://sonicscan.org",
  },
  {
    value: "0x82",
    label: "Unichain",
    logo: "/images/logos/networks/unichain-logo.png",
    usdc: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
    usdcSymbol: "USDC",
    usdcDecimals: 6,
    nativeSymbol: "ETH",
    blockExplorerUrl: "https://uniscan.xyz",
  },
];

export const DEFAULT_SWAP_CHAIN_ID =
  SWAP_MAINNET_CHAINS.find((chain) => chain.label === "Base")?.value ??
  SWAP_MAINNET_CHAINS[0]?.value ??
  "0x2105";

export interface ISwapToken {
  symbol: string;
  address: string;
  decimals: number;
  logoURI: string;
}

const ETH_LOGO_URI =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";

const USDC_LOGO_URI =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png";

const USDT_LOGO_URI =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png";

export function chainIdToNumber(hexChainId: string): number {
  return Number.parseInt(hexChainId, 16);
}

export function findSwapChain(hexChainId: string): ISwapChain | undefined {
  return SWAP_MAINNET_CHAINS.find(
    (entry) => entry.value.toLowerCase() === hexChainId.toLowerCase(),
  );
}

export function resolveSwapChainId(hexChainId: string): string {
  return findSwapChain(hexChainId)?.value ?? DEFAULT_SWAP_CHAIN_ID;
}

export function isWalletOnSwapChain(hexChainId: string): boolean {
  return findSwapChain(hexChainId) != null;
}

export function walletMatchesSelectedSwapChain(
  walletChainId: string,
  selectedChainId: string,
): boolean {
  return walletChainId.toLowerCase() === selectedChainId.toLowerCase();
}

function nativeTokenForChain(chain: ISwapChain): ISwapToken {
  return {
    symbol: chain.nativeSymbol,
    address: LIFI_NATIVE_TOKEN,
    decimals: 18,
    logoURI: chain.logo || ETH_LOGO_URI,
  };
}

export function getSwapTokensForChain(hexChainId: string): ISwapToken[] {
  const chain = findSwapChain(hexChainId);
  if (!chain) {
    return [];
  }

  const tokens: ISwapToken[] = [
    {
      symbol: chain.usdcSymbol,
      address: chain.usdc,
      decimals: chain.usdcDecimals,
      logoURI: chain.usdcSymbol === "USDC" ? USDC_LOGO_URI : chain.logo,
    },
  ];

  if (chain.usdt && chain.usdtDecimals !== undefined) {
    tokens.push({
      symbol: "USDT",
      address: chain.usdt,
      decimals: chain.usdtDecimals,
      logoURI: USDT_LOGO_URI,
    });
  }

  tokens.push(nativeTokenForChain(chain));
  return tokens;
}

export function getChainLogo(hexChainId: string): string | undefined {
  return findSwapChain(hexChainId)?.logo;
}

export function findSwapToken(
  hexChainId: string,
  address: string,
): ISwapToken | undefined {
  return getSwapTokensForChain(hexChainId).find(
    (token) => token.address.toLowerCase() === address.toLowerCase(),
  );
}

export function defaultFromToken(hexChainId: string): ISwapToken | undefined {
  const chain = findSwapChain(hexChainId);
  if (!chain) return undefined;
  return getSwapTokensForChain(hexChainId).find(
    (token) => token.symbol === chain.usdcSymbol,
  );
}

export function defaultToToken(hexChainId: string): ISwapToken | undefined {
  const chain = findSwapChain(hexChainId);
  if (!chain) return undefined;
  return getSwapTokensForChain(hexChainId).find(
    (token) => token.symbol === chain.nativeSymbol,
  );
}

export function isNativeToken(address: string): boolean {
  return address.toLowerCase() === LIFI_NATIVE_TOKEN.toLowerCase();
}

export function swapChainLabel(hexChainId: string): string | undefined {
  return findSwapChain(hexChainId)?.label ?? hostChainMeta(hexChainId)?.label;
}

export function tokenDisplayLogo(
  token: ISwapToken | undefined,
  quoteLogoUri?: string,
): string | undefined {
  return quoteLogoUri ?? token?.logoURI;
}
