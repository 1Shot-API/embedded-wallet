import {
  EVMAccountAddress,
  EVMChainId,
  type EVMAccountAddress as EVMAccountAddressType,
  type EVMChainId as EVMChainIdType,
} from "@1shotapi/ows-types";
import { KnownAsset } from "../../types/domain/KnownAsset";
import { EAssetType } from "../../types/enum/EAssetType";
import { makeTrackedAssetId } from "../../types/primitives";
import {
  iconUrlForSymbol,
  registerKnownAssetIconResolver,
} from "../../utils/tokenIcons";

type ISeedRow = {
  chainId: EVMChainIdType;
  address: EVMAccountAddressType;
  symbol: string;
  name: string;
  decimals: number;
};

function seed(row: ISeedRow): KnownAsset {
  return new KnownAsset(
    row.chainId,
    row.address,
    EAssetType.Erc20,
    row.name,
    row.symbol,
    row.decimals,
    iconUrlForSymbol(row.symbol),
  );
}

/**
 * Static snapshot from `relayer_getCapabilities` (prod + dev) plus Arc USDC.
 * @see https://www.1shotapi.com/docs/relayer/get-started/overview
 */
const SEED_ROWS: readonly ISeedRow[] = [
  // Arc mainnet — no MetaMask contracts / relayer yet.
  {
    chainId: EVMChainId("0x13b2"),
    address: EVMAccountAddress(
      "0x3600000000000000000000000000000000000000",
    ),
    symbol: "USDC",
    name: "USDC",
    decimals: 6,
  },
  // Arc Testnet — demo network, not returned by relayer.
  {
    chainId: EVMChainId("0x4cef52"),
    address: EVMAccountAddress(
      "0x3600000000000000000000000000000000000000",
    ),
    symbol: "USDC",
    name: "USDC",
    decimals: 6,
  },
  // Ethereum mainnet (1)
  {
    chainId: EVMChainId("0x1"),
    address: EVMAccountAddress(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0x1"),
    address: EVMAccountAddress(
      "0xdac17f958d2ee523a2206206994597c13d831ec7",
    ),
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0x1"),
    address: EVMAccountAddress(
      "0xe343167631d89B6Ffc58B88d6b7fB0228795491D",
    ),
    symbol: "USDG",
    name: "Global Dollar",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0x1"),
    address: EVMAccountAddress(
      "0xacA92E438df0B2401fF60dA7E4337B687a2435DA",
    ),
    symbol: "mUSD",
    name: "mUSD",
    decimals: 6,
  },
  // Optimism (10)
  {
    chainId: EVMChainId("0xa"),
    address: EVMAccountAddress(
      "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0xa"),
    address: EVMAccountAddress(
      "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
    ),
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  // BSC (56)
  {
    chainId: EVMChainId("0x38"),
    address: EVMAccountAddress(
      "0x8AC76a51cc950d9822D68b83fe1Ad97B32Cd580d",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 18,
  },
  {
    chainId: EVMChainId("0x38"),
    address: EVMAccountAddress(
      "0x55d398326f99059fF775485246999027B3197955",
    ),
    symbol: "USDT",
    name: "Tether USD",
    decimals: 18,
  },
  // Unichain (130)
  {
    chainId: EVMChainId("0x82"),
    address: EVMAccountAddress(
      "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0x82"),
    address: EVMAccountAddress(
      "0xfe97E85d13ABD9c1c33384E796F10B73905637cE",
    ),
    symbol: "USD₮0",
    name: "Tether USD",
    decimals: 6,
  },
  // Polygon (137)
  {
    chainId: EVMChainId("0x89"),
    address: EVMAccountAddress(
      "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0x89"),
    address: EVMAccountAddress(
      "0xc2132D05D31c914a87C6611C10748AeB04B58e8F",
    ),
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  // Sonic (146)
  {
    chainId: EVMChainId("0x92"),
    address: EVMAccountAddress(
      "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  // Monad (143)
  {
    chainId: EVMChainId("0x8f"),
    address: EVMAccountAddress(
      "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0x8f"),
    address: EVMAccountAddress(
      "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    ),
    symbol: "USDT0",
    name: "Tether USD",
    decimals: 6,
  },
  // Base (8453)
  {
    chainId: EVMChainId("0x2105"),
    address: EVMAccountAddress(
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0x2105"),
    address: EVMAccountAddress(
      "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
    ),
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  // Arbitrum (42161)
  {
    chainId: EVMChainId("0xa4b1"),
    address: EVMAccountAddress(
      "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0xa4b1"),
    address: EVMAccountAddress(
      "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    ),
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  // Celo (42220)
  {
    chainId: EVMChainId("0xa4ec"),
    address: EVMAccountAddress(
      "0xcebA9300f2b948710d2653dd7b07f33A8B32118C",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0xa4ec"),
    address: EVMAccountAddress(
      "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    ),
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  // Linea (59144)
  {
    chainId: EVMChainId("0xe708"),
    address: EVMAccountAddress(
      "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0xe708"),
    address: EVMAccountAddress(
      "0xA219439258ca9da29E9Cc4cE5596924745e12B93",
    ),
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  {
    chainId: EVMChainId("0xe708"),
    address: EVMAccountAddress(
      "0xaca92e438df0b2401ff60da7e4337b687a2435da",
    ),
    symbol: "mUSD",
    name: "mUSD",
    decimals: 6,
  },
  // Base Sepolia (84532)
  {
    chainId: EVMChainId("0x14a34"),
    address: EVMAccountAddress(
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  // Sepolia (11155111)
  {
    chainId: EVMChainId("0xaa36a7"),
    address: EVMAccountAddress(
      "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    ),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
];

export const RELAYER_KNOWN_ASSETS: readonly KnownAsset[] =
  SEED_ROWS.map(seed);

const BY_KEY = new Map(
  RELAYER_KNOWN_ASSETS.map((asset) => [
    makeTrackedAssetId(asset.chainId, asset.address),
    asset,
  ]),
);

export function getKnownAssetIconUrl(
  chainId: EVMChainIdType,
  address: EVMAccountAddressType,
): string | undefined {
  return BY_KEY.get(makeTrackedAssetId(chainId, address))?.iconUrl;
}

registerKnownAssetIconResolver(getKnownAssetIconUrl);
