import {
  ChainUtils,
  EVMChainIdSchema,
  EVMContractAddressSchema,
  OwsUserRejectedError,
  SolanaChainIdSchema,
  SolanaMintAddressSchema,
  type EVMAccountAddress as EVMAccountAddressType,
  type EVMChainId,
  type EVMContractAddress,
  type SolanaAccountAddress,
  type SolanaChainId,
  type SolanaMintAddress,
} from "@1shotapi/ows-types";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { z } from "zod";

import type { CachedRelayerVaultRepository } from "../lib/implementations/data/CachedRelayerVaultRepository";
import type { ISolanaService } from "../lib/interfaces/business/ISolanaService";
import type {
  IKnownAssetRepository,
  ITrackedAssetRepository,
} from "../lib/interfaces/data";
import { isSafeHttpsIconUrl } from "../lib/utils/tokenIcons";

import { useWalletSessionStore } from "./sessionStore";
import { withWalletReady, type WalletReadyGate } from "./withWalletReady";

/** Custom RPC — host: `await proxy.rpc("addAsset", { chainId, assetAddress, iconUrl? })`. */
export const ADD_ASSET_RPC_METHOD = "addAsset";

const addAssetParamsSchema = z.strictObject({
  chainId: z.union([EVMChainIdSchema, SolanaChainIdSchema]),
  assetAddress: z.union([EVMContractAddressSchema, SolanaMintAddressSchema]),
  iconUrl: z
    .url()
    .refine((url) => isSafeHttpsIconUrl(url), {
      message: "iconUrl must be an https URL",
    })
    .optional(),
});

export type IAddAssetParams = z.infer<typeof addAssetParamsSchema>;

export interface IAddAssetApprovalRequest {
  chainId: EVMChainId | SolanaChainId;
  assetAddress: EVMContractAddress | SolanaMintAddress;
  /** Resolved token name for the confirm modal. */
  assetName: string;
  assetSymbol: string;
  /** Optional host-supplied HTTPS icon for preview + persistence. */
  iconUrl?: string;
  /** Solana: estimated ATA rent in SOL (display string), when creating. */
  ataRentSol?: string;
}

export type RegisterAddAssetOptions = {
  ensureReady: WalletReadyGate;
  knownAssetRepository: IKnownAssetRepository;
  trackedAssetRepository: ITrackedAssetRepository;
  solanaService: ISolanaService;
  /** Prefetch RelayerAuth on ATA create sign for tracked-assets vault sync. */
  credentialRepository: CachedRelayerVaultRepository;
  getOwnerAddress: () => EVMAccountAddressType;
  getSolanaAddress: () => SolanaAccountAddress | null;
  requestAddAssetApproval: (
    request: IAddAssetApprovalRequest,
  ) => Promise<boolean>;
};

/**
 * Register host `addAsset` RPC (always requires user confirmation).
 * EVM: resolves ERC-20 metadata before confirm.
 * Solana: catalog mint only; creates ATA then tracks.
 */
export function registerAddAssetRpc(
  wallet: OWSWallet,
  options: RegisterAddAssetOptions,
): void {
  wallet.registerRpc(
    ADD_ASSET_RPC_METHOD,
    withWalletReady(options.ensureReady, async (params) => {
      const { chainId, assetAddress, iconUrl } = params as IAddAssetParams;

      if (ChainUtils.isSolanaChainId(chainId)) {
        const solOwner = options.getSolanaAddress();
        if (!solOwner || solOwner === ("—" as SolanaAccountAddress)) {
          throw new Error("Solana address not available");
        }
        const mint = assetAddress as SolanaMintAddress;
        const resolved = await options.knownAssetRepository.resolveForTracking(
          chainId,
          mint,
          solOwner,
        );
        const rentLamports = options.solanaService.estimateAtaRentLamports();
        const ataRentSol = (Number(rentLamports) / 1e9).toFixed(4);
        const [toPersistBase, display] = await Promise.all([
          Promise.resolve(iconUrl ? resolved.withIconUrl(iconUrl) : resolved),
          wallet.requestDisplay(),
        ]);
        try {
          if (
            !(await options.requestAddAssetApproval({
              chainId,
              assetAddress: mint,
              assetName: resolved.name,
              assetSymbol: resolved.symbol,
              iconUrl: toPersistBase.iconUrl,
              ataRentSol,
            }))
          ) {
            throw new OwsUserRejectedError("User rejected add asset request");
          }

          options.credentialRepository.armRelayerAuthPrefetch();
          let ataResult;
          try {
            ataResult = await options.solanaService.ensureAta({
              chainId,
              owner: solOwner,
              mint,
            });
            if (!ataResult.created) {
              options.credentialRepository.clearRelayerAuthPrefetch();
            }
          } catch (error: unknown) {
            options.credentialRepository.clearRelayerAuthPrefetch();
            throw error;
          }
          const toPersist = toPersistBase.withAta(
            ataResult.ataAddress,
            true,
          );
          await options.trackedAssetRepository.add(toPersist, solOwner);
          const listed = await options.trackedAssetRepository.list();
          useWalletSessionStore.getState().setTrackedAssetCount(listed.length);

          return {
            ok: true as const,
            chainId,
            assetAddress: mint,
          };
        } finally {
          await display.hide();
        }
      }

      const owner = options.getOwnerAddress();
      const [resolved, display] = await Promise.all([
        options.knownAssetRepository.resolveForTracking(
          chainId as EVMChainId,
          assetAddress as EVMContractAddress,
          owner,
        ),
        wallet.requestDisplay(),
      ]);
      const toPersist = iconUrl ? resolved.withIconUrl(iconUrl) : resolved;
      try {
        if (
          !(await options.requestAddAssetApproval({
            chainId: chainId as EVMChainId,
            assetAddress: assetAddress as EVMContractAddress,
            assetName: resolved.name,
            assetSymbol: resolved.symbol,
            iconUrl: toPersist.iconUrl,
          }))
        ) {
          throw new OwsUserRejectedError("User rejected add asset request");
        }

        await options.trackedAssetRepository.add(toPersist, owner);
        const listed = await options.trackedAssetRepository.list();
        useWalletSessionStore.getState().setTrackedAssetCount(listed.length);

        return {
          ok: true as const,
          chainId,
          assetAddress,
        };
      } finally {
        await display.hide();
      }
    }),
    addAssetParamsSchema,
  );
}
