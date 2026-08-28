import { EVMChainId } from "@1shotapi/ows-types";

/**
 * Catalog EVM chain ids (hex). Prefer these over inline `EVMChainId("0x…")`.
 */
export const EChain = {
  Arc: EVMChainId("0x13b2"),
  ArcTestnet: EVMChainId("0x4cef52"),
  Sepolia: EVMChainId("0xaa36a7"),
  BaseSepolia: EVMChainId("0x14a34"),
  Ethereum: EVMChainId("0x1"),
  Linea: EVMChainId("0xe708"),
  Arbitrum: EVMChainId("0xa4b1"),
  Optimism: EVMChainId("0xa"),
  Bsc: EVMChainId("0x38"),
  Base: EVMChainId("0x2105"),
  Polygon: EVMChainId("0x89"),
  Sonic: EVMChainId("0x92"),
  Unichain: EVMChainId("0x82"),
  Monad: EVMChainId("0x8f"),
  Celo: EVMChainId("0xa4ec"),
  Robinhood: EVMChainId("0x1237"),
} as const;

export type EChain = (typeof EChain)[keyof typeof EChain];
