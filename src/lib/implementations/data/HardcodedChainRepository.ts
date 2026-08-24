import {
  EVMChainId,
  type EVMAccountAddress,
  type EVMChainId as EVMChainIdType,
} from "@1shotapi/ows-types";
import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import { SupportedChain } from "../../types/domain/SupportedChain";
import { EChainNetworkType } from "../../types/enum/EChainNetworkType";

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
 * @see https://1shotapi.com/docs/relayer/get-started/overview
 */
const CATALOG: readonly SupportedChain[] = [
  new SupportedChain(
    EVMChainId("0x13b2"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    false,
    arcLogo,
    true,
    `https://arc-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Arc",
    "https://explorer.arc.io",
  ),
  new SupportedChain(
    EVMChainId("0x4cef52"),
    EChainNetworkType.Testnet,
    DEVELOPMENT_RELAYER_URL,
    true,
    arcLogo,
    true,
    `https://arc-testnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Arc Testnet",
    "https://testnet.arcscan.app",
  ),
  new SupportedChain(
    EVMChainId("0xaa36a7"),
    EChainNetworkType.Testnet,
    DEVELOPMENT_RELAYER_URL,
    true,
    ethereumLogo,
    true,
    `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Sepolia",
    "https://sepolia.etherscan.io",
  ),
  new SupportedChain(
    EVMChainId("0x14a34"),
    EChainNetworkType.Testnet,
    DEVELOPMENT_RELAYER_URL,
    true,
    baseLogo,
    true,
    `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Base Sepolia",
    "https://sepolia.basescan.org",
  ),
  new SupportedChain(
    EVMChainId("0x1"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    ethereumLogo,
    true,
    "https://ethereum.publicnode.com",
    "Ethereum",
    "https://etherscan.io",
  ),
  new SupportedChain(
    EVMChainId("0xe708"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    lineaLogo,
    true,
    "https://rpc.linea.build",
    "Linea",
    "https://lineascan.build",
  ),
  new SupportedChain(
    EVMChainId("0xa4b1"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    arbitrumLogo,
    true,
    "https://arb1.arbitrum.io/rpc",
    "Arbitrum",
    "https://arbiscan.io",
  ),
  new SupportedChain(
    EVMChainId("0xa"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    optimismLogo,
    true,
    "https://mainnet.optimism.io",
    "Optimism",
    "https://optimistic.etherscan.io",
  ),
  new SupportedChain(
    EVMChainId("0x38"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    binanceLogo,
    true,
    "https://bsc-dataseed.binance.org",
    "BSC",
    "https://bscscan.com",
  ),
  new SupportedChain(
    EVMChainId("0x2105"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    baseLogo,
    true,
    `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Base",
    "https://basescan.org",
  ),
  new SupportedChain(
    EVMChainId("0x89"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    polygonLogo,
    true,
    "https://polygon-rpc.com",
    "Polygon",
    "https://polygonscan.com",
  ),
  new SupportedChain(
    EVMChainId("0x92"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    sonicLogo,
    true,
    "https://rpc.soniclabs.com",
    "Sonic",
    "https://sonicscan.org",
  ),
  new SupportedChain(
    EVMChainId("0x82"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    unichainLogo,
    true,
    "https://mainnet.unichain.org",
    "Unichain",
    "https://uniscan.xyz",
  ),
  new SupportedChain(
    EVMChainId("0x8f"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    monadLogo,
    true,
    "https://rpc.monad.xyz",
    "Monad",
    "https://monadvision.com",
  ),
  new SupportedChain(
    EVMChainId("0xa4ec"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    celoLogo,
    true,
    "https://forno.celo.org",
    "Celo",
    "https://celoscan.io",
  ),
  new SupportedChain(
    EVMChainId("0x1237"),
    EChainNetworkType.Mainnet,
    PRODUCTION_RELAYER_URL,
    true,
    robinhoodLogo,
    true,
    `https://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "Robinhood",
    "https://robinhoodchain.blockscout.com",
  ),
];

/** Default chain for a fresh session (Arc mainnet). */
export const DEFAULT_CHAIN_ID = EVMChainId("0x13b2");

export class HardcodedChainRepository implements IChainRepository {
  private allowedChains: Set<string> | null = null;
  private readonly listeners = new Set<() => void>();

  async list(): Promise<SupportedChain[]> {
    return CATALOG.filter((chain) => {
      if (!chain.enabled) {
        return false;
      }
      if (this.allowedChains == null || this.allowedChains.size === 0) {
        return true;
      }
      return this.allowedChains.has(String(chain.chainId).toLowerCase());
    });
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


