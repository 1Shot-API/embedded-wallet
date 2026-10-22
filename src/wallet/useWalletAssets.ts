import {
  type CredentialId,
  type EVMAccountAddress,
  type EVMContractAddress,
  type EVMChainId,
  type SolanaAccountAddress,
  type SolanaChainId,
  type SolanaMintAddress,
  ChainUtils,
} from "@1shotapi/ows-types";
import { useCallback } from "react";

import type { CachedRelayerVaultRepository } from "../lib/implementations/data/CachedRelayerVaultRepository";
import type { ISolanaService } from "../lib/interfaces/business/ISolanaService";
import type {
  IAssetActivityRepository,
  IKnownAssetRepository,
  IRecordSentActivityParams,
  ITrackedAssetRepository,
} from "../lib/interfaces/data";
import type { IEventBus } from "../lib/interfaces/utils";
import type {
  AssetActivity,
  KnownAsset,
  KnownAssetAddress,
  KnownAssetChainId,
  SolanaKnownAsset,
  TrackedAsset,
} from "../lib/types/domain";
import { RefreshBalanceRequestedEvent } from "../lib/types/events/RefreshBalanceRequestedEvent";
import type { TrackedAssetId } from "../lib/types/primitives";
import type { DelegationId } from "../lib/types/primitives/DelegationId";

import { useWalletSessionStore } from "./sessionStore";

export interface IUseWalletAssetsParams {
  credentialRepository: CachedRelayerVaultRepository;
  knownAssetRepository: IKnownAssetRepository;
  trackedAssetRepository: ITrackedAssetRepository;
  assetActivityRepository: IAssetActivityRepository;
  solanaService: ISolanaService;
  eventBus: IEventBus;
  /** Vault recover needs the Signing Layer for decryptAES256 only — not unlock. */
  awaitSignerReady: () => Promise<unknown>;
  refreshCredentialCount: () => Promise<void>;
}

export function useWalletAssets({
  credentialRepository,
  knownAssetRepository,
  trackedAssetRepository,
  assetActivityRepository,
  solanaService,
  eventBus,
  awaitSignerReady,
  refreshCredentialCount,
}: IUseWalletAssetsParams) {
  const refreshTrackedAssetCount = useCallback(async () => {
    const listed = await trackedAssetRepository.list();
    useWalletSessionStore.getState().setTrackedAssetCount(listed.length);
  }, [trackedAssetRepository]);

  const ensureVaultDecrypted = useCallback(async () => {
    await awaitSignerReady();
    await credentialRepository.ensureDecrypted();
  }, [awaitSignerReady, credentialRepository]);

  const listCredentials = useCallback(async () => {
    await ensureVaultDecrypted();
    return credentialRepository.list();
  }, [credentialRepository, ensureVaultDecrypted]);

  const getCredential = useCallback(
    async (credentialId: CredentialId) => {
      await ensureVaultDecrypted();
      return credentialRepository.get(credentialId);
    },
    [credentialRepository, ensureVaultDecrypted],
  );

  const refreshCredentialsFromRelayer = useCallback(async () => {
    // Do not call ensureReady/unlock first — that can nest unlock + recover.
    // Recover queues encrypted blobs; ensureDecrypted runs only when listing.
    await awaitSignerReady();
    await credentialRepository.refreshFromRelayer();
    await credentialRepository.ensureDecrypted();
    await refreshCredentialCount();
  }, [awaitSignerReady, credentialRepository, refreshCredentialCount]);

  const listDelegations = useCallback(async () => {
    await ensureVaultDecrypted();
    return credentialRepository.listDelegations();
  }, [credentialRepository, ensureVaultDecrypted]);

  const getDelegation = useCallback(
    async (delegationId: DelegationId) => {
      await ensureVaultDecrypted();
      return credentialRepository.getDelegation(delegationId);
    },
    [credentialRepository, ensureVaultDecrypted],
  );

  const refreshDelegationsFromRelayer = useCallback(async () => {
    await refreshCredentialsFromRelayer();
  }, [refreshCredentialsFromRelayer]);

  const listTrackedAssets = useCallback(
    async (chainId?: KnownAssetChainId) => {
      return trackedAssetRepository.list(chainId);
    },
    [trackedAssetRepository],
  );

  const listSolanaKnownAssets = useCallback(
    async (chainId: SolanaChainId): Promise<SolanaKnownAsset[]> => {
      return knownAssetRepository.listSolanaKnownAssets(chainId);
    },
    [knownAssetRepository],
  );

  const addTrackedAsset = useCallback(
    async (chainId: EVMChainId, address: EVMContractAddress) => {
      const owner = useWalletSessionStore.getState().evmAddress;
      const resolved = await knownAssetRepository.resolveForTracking(
        chainId,
        address,
        owner,
      );
      const tracked = await trackedAssetRepository.add(resolved, owner);
      await refreshTrackedAssetCount();
      return tracked;
    },
    [
      knownAssetRepository,
      refreshTrackedAssetCount,
      trackedAssetRepository,
    ],
  );

  /**
   * Catalog Solana mint → ensure ATA (user pays rent) → track with ATA fields.
   * Prefetches RelayerAuth during the create-ATA sign so tracked-assets sync
   * reuses the cached assertion (tracked assets are unencrypted).
   */
  const addSolanaTrackedAsset = useCallback(
    async (chainId: SolanaChainId, mint: SolanaMintAddress) => {
      const solOwner = useWalletSessionStore.getState().solanaAddress;
      if (!solOwner || solOwner === "—") {
        throw new Error("Solana address not available");
      }
      const resolved = await knownAssetRepository.resolveForTracking(
        chainId,
        mint,
        solOwner,
      );
      credentialRepository.armRelayerAuthPrefetch();
      let ataResult;
      try {
        ataResult = await solanaService.ensureAta({
          chainId,
          owner: solOwner,
          mint,
        });
        if (!ataResult.created) {
          // No sign ceremony — drop unused arm; sync will assert if needed.
          credentialRepository.clearRelayerAuthPrefetch();
        }
      } catch (error: unknown) {
        credentialRepository.clearRelayerAuthPrefetch();
        throw error;
      }
      const tracked = await trackedAssetRepository.add(
        resolved.withAta(ataResult.ataAddress, true),
        solOwner,
      );
      await refreshTrackedAssetCount();
      return tracked;
    },
    [
      credentialRepository,
      knownAssetRepository,
      refreshTrackedAssetCount,
      solanaService,
      trackedAssetRepository,
    ],
  );

  const removeTrackedAsset = useCallback(
    async (chainId: KnownAssetChainId, address: KnownAssetAddress) => {
      await trackedAssetRepository.remove(chainId, address);
      await refreshTrackedAssetCount();
    },
    [refreshTrackedAssetCount, trackedAssetRepository],
  );

  /**
   * Close empty ATA on-chain, then untrack. RelayerAuth is prefetched on the
   * close TX sign so vault sync needs no second passkey.
   */
  const closeSolanaAtaAndUntrack = useCallback(
    async (
      chainId: SolanaChainId,
      mint: SolanaMintAddress,
      owner: SolanaAccountAddress,
    ) => {
      credentialRepository.armRelayerAuthPrefetch();
      try {
        await solanaService.closeAta({ chainId, owner, mint });
      } catch (error: unknown) {
        credentialRepository.clearRelayerAuthPrefetch();
        throw error;
      }
      await trackedAssetRepository.remove(chainId, mint);
      await refreshTrackedAssetCount();
    },
    [
      credentialRepository,
      refreshTrackedAssetCount,
      solanaService,
      trackedAssetRepository,
    ],
  );

  const getKnownAsset = useCallback(
    async (
      chainId: KnownAssetChainId,
      address: KnownAssetAddress,
    ): Promise<KnownAsset | null> => {
      return knownAssetRepository.getKnownAsset(chainId, address);
    },
    [knownAssetRepository],
  );

  const resolveTrackedAsset = useCallback(
    async (chainId: EVMChainId, address: EVMContractAddress) => {
      const owner = useWalletSessionStore.getState().evmAddress;
      const listed = await trackedAssetRepository.list(chainId);
      const existing = listed.find(
        (asset) =>
          asset.chainId === chainId && asset.address === address,
      );
      if (existing) return existing;
      const resolved = await knownAssetRepository.resolveForTracking(
        chainId,
        address,
        owner,
      );
      const tracked = await trackedAssetRepository.add(resolved, owner);
      await refreshTrackedAssetCount();
      return tracked;
    },
    [
      knownAssetRepository,
      refreshTrackedAssetCount,
      trackedAssetRepository,
    ],
  );

  const requestBalanceRefresh = useCallback(
    async (id?: TrackedAssetId, chainId?: KnownAssetChainId) => {
      eventBus.emit(new RefreshBalanceRequestedEvent(id));
      const {
        evmAddress,
        solanaAddress,
        chainId: sessionChainId,
      } = useWalletSessionStore.getState();
      try {
        if (id) {
          const owner =
            solanaAddress && solanaAddress !== "—" ? solanaAddress : evmAddress;
          // Prefer Solana owner when the id looks Solana (CAIP chain prefix).
          const useSol =
            id.includes("solana:") &&
            solanaAddress &&
            solanaAddress !== "—";
          await trackedAssetRepository.getBalances(
            useSol ? solanaAddress! : owner,
            { id },
          );
          return;
        }
        const scope = chainId ?? sessionChainId;
        if (ChainUtils.isSolanaChainId(scope)) {
          if (!solanaAddress || solanaAddress === "—") return;
          await trackedAssetRepository.getBalances(solanaAddress, {
            chainId: scope,
          });
          return;
        }
        if (ChainUtils.isEVMChainId(scope)) {
          await trackedAssetRepository.getBalances(evmAddress, {
            chainId: scope,
          });
        }
      } catch (error: unknown) {
        console.error("[oneshot-wallet] balance refresh failed", error);
        throw error;
      }
    },
    [eventBus, trackedAssetRepository],
  );

  const listAssetActivity = useCallback(
    async (
      owner: EVMAccountAddress,
      asset: TrackedAsset,
      limit?: number,
    ): Promise<AssetActivity[]> => {
      return assetActivityRepository.list({ owner, asset, limit });
    },
    [assetActivityRepository],
  );

  const recordSentActivity = useCallback(
    async (params: IRecordSentActivityParams) => {
      return assetActivityRepository.recordSent(params);
    },
    [assetActivityRepository],
  );

  return {
    listCredentials,
    getCredential,
    refreshCredentialsFromRelayer,
    listDelegations,
    getDelegation,
    refreshDelegationsFromRelayer,
    listTrackedAssets,
    listSolanaKnownAssets,
    addTrackedAsset,
    addSolanaTrackedAsset,
    removeTrackedAsset,
    closeSolanaAtaAndUntrack,
    getKnownAsset,
    resolveTrackedAsset,
    requestBalanceRefresh,
    listAssetActivity,
    recordSentActivity,
  };
}
