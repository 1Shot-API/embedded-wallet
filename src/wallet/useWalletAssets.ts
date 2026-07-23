import { useCallback } from "react";
import type {
  CredentialId,
  EVMAccountAddress,
  EVMChainId,
} from "@1shotapi/ows-types";
import type { CachedRelayerCredentialRepository } from "../credentials/CachedRelayerCredentialRepository";
import type {
  IAssetActivityRepository,
  IKnownAssetRepository,
  IRecordSentActivityParams,
  ITrackedAssetRepository,
} from "../lib/interfaces/data";
import type { IEventBus } from "../lib/interfaces/utils";
import type {
  AssetActivity,
  TrackedAsset,
} from "../lib/types/domain";
import { RefreshBalanceRequestedEvent } from "../lib/types/events/RefreshBalanceRequestedEvent";
import type { TrackedAssetId } from "../lib/types/primitives";
import { useWalletSessionStore } from "./sessionStore";

export interface IUseWalletAssetsParams {
  credentialRepository: CachedRelayerCredentialRepository;
  knownAssetRepository: IKnownAssetRepository;
  trackedAssetRepository: ITrackedAssetRepository;
  assetActivityRepository: IAssetActivityRepository;
  eventBus: IEventBus;
  ensureReady: () => Promise<void>;
  refreshCredentialCount: () => Promise<void>;
}

export function useWalletAssets({
  credentialRepository,
  knownAssetRepository,
  trackedAssetRepository,
  assetActivityRepository,
  eventBus,
  ensureReady,
  refreshCredentialCount,
}: IUseWalletAssetsParams) {
  const refreshTrackedAssetCount = useCallback(async () => {
    const owner = useWalletSessionStore.getState().evmAddress;
    const listed = await trackedAssetRepository.list(owner);
    useWalletSessionStore.getState().setTrackedAssetCount(listed.length);
  }, [trackedAssetRepository]);

  const listCredentials = useCallback(async () => {
    return credentialRepository.list();
  }, [credentialRepository]);

  const getCredential = useCallback(
    async (credentialId: CredentialId) => {
      return credentialRepository.get(credentialId);
    },
    [credentialRepository],
  );

  const refreshCredentialsFromRelayer = useCallback(async () => {
    await ensureReady();
    await credentialRepository.refreshFromRelayer();
    await refreshCredentialCount();
  }, [credentialRepository, ensureReady, refreshCredentialCount]);

  const listTrackedAssets = useCallback(async () => {
    const owner = useWalletSessionStore.getState().evmAddress;
    return trackedAssetRepository.list(owner);
  }, [trackedAssetRepository]);

  const addTrackedAsset = useCallback(
    async (chainId: EVMChainId, address: EVMAccountAddress) => {
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

  const removeTrackedAsset = useCallback(
    async (chainId: EVMChainId, address: EVMAccountAddress) => {
      await trackedAssetRepository.remove(chainId, address);
      await refreshTrackedAssetCount();
    },
    [refreshTrackedAssetCount, trackedAssetRepository],
  );

  const getKnownAsset = useCallback(
    async (chainId: EVMChainId, address: EVMAccountAddress) => {
      return knownAssetRepository.getKnownAsset(chainId, address);
    },
    [knownAssetRepository],
  );

  const resolveTrackedAsset = useCallback(
    async (chainId: EVMChainId, address: EVMAccountAddress) => {
      const owner = useWalletSessionStore.getState().evmAddress;
      const listed = await trackedAssetRepository.list(owner);
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
    async (id?: TrackedAssetId) => {
      eventBus.emit(new RefreshBalanceRequestedEvent(id));
      const owner = useWalletSessionStore.getState().evmAddress;
      try {
        await trackedAssetRepository.getBalances(owner, id);
        useWalletSessionStore.getState().setTrackedAssetCount(
          (await trackedAssetRepository.list(owner)).length,
        );
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
    listTrackedAssets,
    addTrackedAsset,
    removeTrackedAsset,
    getKnownAsset,
    resolveTrackedAsset,
    requestBalanceRefresh,
    listAssetActivity,
    recordSentActivity,
  };
}
