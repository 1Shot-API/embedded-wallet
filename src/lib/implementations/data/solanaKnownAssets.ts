import {
  SOLANA_DEVNET_CHAIN_ID,
  SOLANA_MAINNET_CHAIN_ID,
  SolanaMintAddress,
} from "@1shotapi/ows-types";

import usdcIcon from "../../../assets/images/tokens/CircleUSDC.svg";
import { type SolanaKnownAsset, KnownAsset } from "../../types/domain/KnownAsset";
import { EAssetType } from "../../types/enum/EAssetType";

/** Mainnet Circle USDC mint. */
export const SOLANA_USDC_MAINNET_MINT = SolanaMintAddress(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

/** Devnet Circle USDC mint (playground / test). */
export const SOLANA_USDC_DEVNET_MINT = SolanaMintAddress(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

/**
 * Catalog-only Solana SPL assets (not default-tracked — ATA rent).
 * User Add Asset creates the ATA then tracks.
 */
export const SOLANA_KNOWN_ASSETS: readonly SolanaKnownAsset[] = [
  new KnownAsset(
    SOLANA_MAINNET_CHAIN_ID,
    SOLANA_USDC_MAINNET_MINT,
    EAssetType.Spl,
    "USD Coin",
    "USDC",
    6,
    true,
    false,
    100,
    usdcIcon,
  ),
  new KnownAsset(
    SOLANA_DEVNET_CHAIN_ID,
    SOLANA_USDC_DEVNET_MINT,
    EAssetType.Spl,
    "USD Coin",
    "USDC",
    6,
    true,
    false,
    100,
    usdcIcon,
  ),
] as SolanaKnownAsset[];
