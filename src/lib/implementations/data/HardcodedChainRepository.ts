import {
  type EVMAccountAddress,
  type EVMChainId as EVMChainIdType,
  type OWSChainId,
} from "@1shotapi/ows-types";
import { EnableArcMainnet } from "../../features";
import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import {
  type INativeCurrency,
  SupportedChain,
} from "../../types/domain/SupportedChain";
import { EChain } from "../../types/enum/EChain";
import { EChainNetworkType } from "../../types/enum/EChainNetworkType";
import { ChainDisplayUtils } from "../utils/ChainDisplayUtils";

import bitcoinLogo from "../../../assets/images/chains/bitcoin-logo.svg";
import arcLogo from "../../../assets/images/chains/arc-logo.png";
import arbitrumLogo from "../../../assets/images/chains/arbitrum-logo.png";
import binanceLogo from "../../../assets/images/chains/binance-logo.png";
import baseLogo from "../../../assets/images/chains/coinbase-base-logo.png";
import celoLogo from "../../../assets/images/chains/celo-logo.png";
import ethereumLogo from "../../../assets/images/chains/ethereum-eth-logo.png";
import lineaLogo from "../../../assets/images/chains/linea-logo.png";
import monadLogo from "../../../assets/images/chains/monad-logo.png";
import optimismLogo from "../../../assets/images/chains/optimism-logo.png";
import polygonLogo from "../../../assets/images/chains/polygon-logo.png";
import robinhoodLogo from "../../../assets/images/chains/robinhood-logo.png";
import sonicLogo from "../../../assets/images/chains/sonic-logo.png";
import unichainLogo from "../../../assets/images/chains/unichain-logo.png";

const PRODUCTION_RELAYER_URL = "https://relayer.1shotapi.com";
const DEVELOPMENT_RELAYER_URL = "https://relayer.1shotapi.dev";

/** Shared Alchemy key used by catalog EVM RPCs. */
const ALCHEMY_KEY = "jqLUTbHeN_cVsIX2W7tJk";

function alchemyRpc(network: string): string {
  return `https://${network}.g.alchemy.com/v2/${ALCHEMY_KEY}`;
}

/**
 * Catalog RPC URL for Bitcoin (Ankr). The API key lives in
 * {@link WalletConfig.ankrBtcApiKey}; {@link AnkrBitcoinRpc} builds authenticated
 * endpoints from config — this catalog value is informational only.
 */
const BITCOIN_RPC_URL = "https://rpc.ankr.com/btc";

const NATIVE_ETH: INativeCurrency = {
  name: "Ether",
  symbol: "ETH",
  decimals: 18,
};
const NATIVE_BTC: INativeCurrency = {
  name: "Bitcoin",
  symbol: "BTC",
  decimals: 8,
};
/** Arc uses USDC as gas — no separate Native tracked row (see known assets). */
const NATIVE_ARC_USDC: INativeCurrency = {
  name: "USDC",
  symbol: "USDC",
  decimals: 6,
};
const NATIVE_BNB: INativeCurrency = {
  name: "BNB",
  symbol: "BNB",
  decimals: 18,
};
const NATIVE_POL: INativeCurrency = {
  name: "POL",
  symbol: "POL",
  decimals: 18,
};
const NATIVE_S: INativeCurrency = {
  name: "Sonic",
  symbol: "S",
  decimals: 18,
};
const NATIVE_MON: INativeCurrency = {
  name: "Monad",
  symbol: "MON",
  decimals: 18,
};
const NATIVE_CELO: INativeCurrency = {
  name: "CELO",
  symbol: "CELO",
  decimals: 18,
};

/**
 * Public Relayer docs networks + Arc Testnet (dev relayer) + Robinhood.
 * EVM chains use Alchemy HTTPS RPCs; Bitcoin catalog RPC is Ankr (informational).
 * `weight` controls order within Mainnet/Testnet groups (higher = first).
 * @see https://1shotapi.com/docs/relayer/get-started/overview
 */
const CATALOG: readonly SupportedChain[] = [
  new SupportedChain(
    EChain.Arc,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    false,
    arcLogo,
    EnableArcMainnet,
    alchemyRpc("arc-mainnet"),
    "Arc",
    "https://explorer.arc.io",
    false,
    NATIVE_ARC_USDC,
    100,
  ),
  new SupportedChain(
    EChain.ArcTestnet,
    EChainNetworkType.Testnet,
    DEVELOPMENT_RELAYER_URL,
    true,
    arcLogo,
    true,
    alchemyRpc("arc-testnet"),
    "Arc Testnet",
    "https://testnet.arcscan.app",
    true,
    NATIVE_ARC_USDC,
    100,
  ),
  new SupportedChain(
    EChain.Sepolia,
    EChainNetworkType.Testnet,
    DEVELOPMENT_RELAYER_URL,
    true,
    ethereumLogo,
    true,
    alchemyRpc("eth-sepolia"),
    "Sepolia",
    "https://sepolia.etherscan.io",
    true,
    NATIVE_ETH,
    80,
  ),
  new SupportedChain(
    EChain.BaseSepolia,
    EChainNetworkType.Testnet,
    DEVELOPMENT_RELAYER_URL,
    true,
    baseLogo,
    true,
    alchemyRpc("base-sepolia"),
    "Base Sepolia",
    "https://sepolia.basescan.org",
    true,
    NATIVE_ETH,
    90,
  ),
  new SupportedChain(
    EChain.BitcoinTestnet,
    EChainNetworkType.Testnet,
    DEVELOPMENT_RELAYER_URL,
    false,
    bitcoinLogo,
    true,
    BITCOIN_RPC_URL,
    "Bitcoin Testnet",
    "https://mempool.space/testnet",
    false,
    NATIVE_BTC,
    75,
  ),
  new SupportedChain(
    EChain.Bitcoin,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    false,
    bitcoinLogo,
    true,
    BITCOIN_RPC_URL,
    "Bitcoin",
    "https://mempool.space",
    false,
    NATIVE_BTC,
    85,
  ),
  new SupportedChain(
    EChain.Ethereum,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    ethereumLogo,
    true,
    alchemyRpc("eth-mainnet"),
    "Ethereum",
    "https://etherscan.io",
    true,
    NATIVE_ETH,
    80,
  ),
  new SupportedChain(
    EChain.Linea,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    lineaLogo,
    true,
    alchemyRpc("linea-mainnet"),
    "Linea",
    "https://lineascan.build",
    true,
    NATIVE_ETH,
  ),
  new SupportedChain(
    EChain.Arbitrum,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    arbitrumLogo,
    true,
    alchemyRpc("arb-mainnet"),
    "Arbitrum",
    "https://arbiscan.io",
    true,
    NATIVE_ETH,
  ),
  new SupportedChain(
    EChain.Optimism,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    optimismLogo,
    true,
    alchemyRpc("opt-mainnet"),
    "Optimism",
    "https://optimistic.etherscan.io",
    true,
    NATIVE_ETH,
  ),
  new SupportedChain(
    EChain.Bsc,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    binanceLogo,
    true,
    alchemyRpc("bnb-mainnet"),
    "BSC",
    "https://bscscan.com",
    false,
    NATIVE_BNB,
  ),
  new SupportedChain(
    EChain.Base,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    baseLogo,
    true,
    alchemyRpc("base-mainnet"),
    "Base",
    "https://basescan.org",
    true,
    NATIVE_ETH,
    90,
  ),
  new SupportedChain(
    EChain.Polygon,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    polygonLogo,
    true,
    alchemyRpc("polygon-mainnet"),
    "Polygon",
    "https://polygonscan.com",
    true,
    NATIVE_POL,
  ),
  new SupportedChain(
    EChain.Sonic,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    sonicLogo,
    true,
    alchemyRpc("sonic-mainnet"),
    "Sonic",
    "https://sonicscan.org",
    true,
    NATIVE_S,
  ),
  new SupportedChain(
    EChain.Unichain,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    unichainLogo,
    true,
    alchemyRpc("unichain-mainnet"),
    "Unichain",
    "https://uniscan.xyz",
    true,
    NATIVE_ETH,
  ),
  new SupportedChain(
    EChain.Monad,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    monadLogo,
    true,
    alchemyRpc("monad-mainnet"),
    "Monad",
    "https://monadvision.com",
    true,
    NATIVE_MON,
  ),
  new SupportedChain(
    EChain.Celo,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    celoLogo,
    true,
    alchemyRpc("celo-mainnet"),
    "Celo",
    "https://celoscan.io",
    false,
    NATIVE_CELO,
  ),
  new SupportedChain(
    EChain.Robinhood,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    robinhoodLogo,
    true,
    alchemyRpc("robinhood-mainnet"),
    "Robinhood",
    "https://robinhoodchain.blockscout.com",
    false,
    NATIVE_ETH,
  ),
];

/** Default chain for a fresh session. */
export const DEFAULT_CHAIN_ID = EnableArcMainnet
  ? EChain.Arc
  : EChain.ArcTestnet;

export class HardcodedChainRepository implements IChainRepository {
  private allowedChains: Set<string> | null = null;
  private readonly listeners = new Set<() => void>();

  async list(): Promise<SupportedChain[]> {
    const enabled = CATALOG.filter((chain) => {
      if (!chain.enabled) {
        return false;
      }
      if (this.allowedChains == null || this.allowedChains.size === 0) {
        return true;
      }
      return this.allowedChains.has(String(chain.chainId).toLowerCase());
    });
    return ChainDisplayUtils.sortForDisplay(enabled);
  }

  async get(chainId: OWSChainId): Promise<SupportedChain | null> {
    const key = String(chainId).toLowerCase();
    return CATALOG.find((chain) => String(chain.chainId).toLowerCase() === key) ?? null;
  }

  setAllowedChains(chainIds: OWSChainId[] | null): void {
    if (chainIds == null || chainIds.length === 0) {
      this.allowedChains = null;
    } else {
      this.allowedChains = new Set(
        chainIds.map((id) => String(id).toLowerCase()),
      );
    }
    for (const listener of this.listeners) {
      listener();
    }
  }

  onAllowedChainsChanged(handler: () => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  /** Full catalog (including disabled), for configurators / configure validation. */
  getCatalog(): readonly SupportedChain[] {
    return CATALOG;
  }

  async getWalletUpgraded(
    chainId: EVMChainIdType,
    address: EVMAccountAddress,
  ): Promise<boolean | null> {
    try {
      const raw = localStorage.getItem(this.upgradeStorageKey(chainId, address));
      if (raw === "true") return true;
      if (raw === "false") return false;
      return null;
    } catch {
      return null;
    }
  }

  async setWalletUpgraded(
    chainId: EVMChainIdType,
    address: EVMAccountAddress,
    upgraded: boolean,
  ): Promise<void> {
    try {
      localStorage.setItem(
        this.upgradeStorageKey(chainId, address),
        upgraded ? "true" : "false",
      );
    } catch {
      // Ignore quota / private-mode failures; getCode remains the source of truth.
    }
  }

  private upgradeStorageKey(
    chainId: EVMChainIdType,
    address: EVMAccountAddress,
  ): string {
    return `oneshot.walletUpgraded.${String(chainId).toLowerCase()}.${String(address).toLowerCase()}`;
  }
}
