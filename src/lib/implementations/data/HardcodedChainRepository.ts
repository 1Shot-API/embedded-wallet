import {
  type EVMAccountAddress,
  type EVMChainId as EVMChainIdType,
} from "@1shotapi/ows-types";
import { EnableArcMainnet } from "../../features";
import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import { SupportedChain } from "../../types/domain/SupportedChain";
import { EChain } from "../../types/enum/EChain";
import { EChainNetworkType } from "../../types/enum/EChainNetworkType";
import { ChainDisplayUtils } from "../utils/ChainDisplayUtils";

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

/** Shared Alchemy key used by existing demo RPCs. */
const ALCHEMY_KEY = "jqLUTbHeN_cVsIX2W7tJk";

/**
 * Public Relayer docs networks + Arc Testnet (dev relayer) + Robinhood.
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
    `https://arc-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Arc",
    "https://explorer.arc.io",
    false,
    100,
  ),
  new SupportedChain(
    EChain.ArcTestnet,
    EChainNetworkType.Testnet,
    DEVELOPMENT_RELAYER_URL,
    true,
    arcLogo,
    true,
    `https://arc-testnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Arc Testnet",
    "https://testnet.arcscan.app",
    true,
    100,
  ),
  new SupportedChain(
    EChain.Sepolia,
    EChainNetworkType.Testnet,
    DEVELOPMENT_RELAYER_URL,
    true,
    ethereumLogo,
    true,
    `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Sepolia",
    "https://sepolia.etherscan.io",
    true,
    80,
  ),
  new SupportedChain(
    EChain.BaseSepolia,
    EChainNetworkType.Testnet,
    DEVELOPMENT_RELAYER_URL,
    true,
    baseLogo,
    true,
    `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Base Sepolia",
    "https://sepolia.basescan.org",
    true,
    90,
  ),
  new SupportedChain(
    EChain.Ethereum,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    ethereumLogo,
    true,
    "https://ethereum.publicnode.com",
    "Ethereum",
    "https://etherscan.io",
    true,
    80,
  ),
  new SupportedChain(
    EChain.Linea,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    lineaLogo,
    true,
    "https://rpc.linea.build",
    "Linea",
    "https://lineascan.build",
    true,
  ),
  new SupportedChain(
    EChain.Arbitrum,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    arbitrumLogo,
    true,
    "https://arb1.arbitrum.io/rpc",
    "Arbitrum",
    "https://arbiscan.io",
    true,
  ),
  new SupportedChain(
    EChain.Optimism,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    optimismLogo,
    true,
    "https://mainnet.optimism.io",
    "Optimism",
    "https://optimistic.etherscan.io",
    true,
  ),
  new SupportedChain(
    EChain.Bsc,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    binanceLogo,
    true,
    "https://bsc-dataseed.binance.org",
    "BSC",
    "https://bscscan.com",
    false,
  ),
  new SupportedChain(
    EChain.Base,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    baseLogo,
    true,
    `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Base",
    "https://basescan.org",
    true,
    90,
  ),
  new SupportedChain(
    EChain.Polygon,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    polygonLogo,
    true,
    "https://polygon-rpc.com",
    "Polygon",
    "https://polygonscan.com",
    true,
  ),
  new SupportedChain(
    EChain.Sonic,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    sonicLogo,
    true,
    "https://rpc.soniclabs.com",
    "Sonic",
    "https://sonicscan.org",
    true,
  ),
  new SupportedChain(
    EChain.Unichain,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    unichainLogo,
    true,
    "https://mainnet.unichain.org",
    "Unichain",
    "https://uniscan.xyz",
    true,
  ),
  new SupportedChain(
    EChain.Monad,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    monadLogo,
    true,
    "https://rpc.monad.xyz",
    "Monad",
    "https://monadvision.com",
    true,
  ),
  new SupportedChain(
    EChain.Celo,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    celoLogo,
    true,
    "https://forno.celo.org",
    "Celo",
    "https://celoscan.io",
    false,
  ),
  new SupportedChain(
    EChain.Robinhood,
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    robinhoodLogo,
    true,
    `https://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Robinhood",
    "https://robinhoodchain.blockscout.com",
    false,
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

  async get(chainId: EVMChainIdType): Promise<SupportedChain | null> {
    const key = String(chainId).toLowerCase();
    return CATALOG.find((chain) => String(chain.chainId).toLowerCase() === key) ?? null;
  }

  setAllowedChains(chainIds: EVMChainIdType[] | null): void {
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
