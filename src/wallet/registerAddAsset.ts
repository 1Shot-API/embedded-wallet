import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  EVMContractAddress,
  EVMChainIdSchema,
  OwsUserRejectedError,
  type EVMAccountAddress as EVMAccountAddressType,
  type EVMChainId,
  EVMContractAddressSchema,
} from "@1shotapi/ows-types";
import type {
  IKnownAssetRepository,
  ITrackedAssetRepository,
} from "../lib/interfaces/data";
import { isSafeHttpsIconUrl } from "../lib/utils/tokenIcons";
import { useWalletSessionStore } from "./sessionStore";

/** Custom RPC — host: `await proxy.rpc("addAsset", { chainId, assetAddress, iconUrl? })`. */
export const ADD_ASSET_RPC_METHOD = "addAsset";

const addAssetParamsSchema = z.strictObject({
  chainId: EVMChainIdSchema,
  assetAddress: EVMContractAddressSchema,
  iconUrl: z
    .url()
    .refine((url) => isSafeHttpsIconUrl(url), {
      message: "iconUrl must be an https URL",
    })
    .optional(),
});

export type IAddAssetParams = z.infer<typeof addAssetParamsSchema>;

export interface IAddAssetApprovalRequest {
  chainId: EVMChainId;
  assetAddress: EVMContractAddress;
  /** Resolved token name for the confirm modal. */
  assetName: string;
  assetSymbol: string;
  /** Optional host-supplied HTTPS icon for preview + persistence. */
  iconUrl?: string;
}

export type RegisterAddAssetOptions = {
  knownAssetRepository: IKnownAssetRepository;
  trackedAssetRepository: ITrackedAssetRepository;
  getOwnerAddress: () => EVMAccountAddressType;
  requestAddAssetApproval: (
    request: IAddAssetApprovalRequest,
  ) => Promise<boolean>;
};

/**
 * Register host `addAsset` RPC (always requires user confirmation).
 * Resolves ERC-20 metadata before the confirm modal.
 */
export function registerAddAssetRpc(
  wallet: OWSWallet,
  options: RegisterAddAssetOptions,
): void {
  wallet.registerRpc(
    ADD_ASSET_RPC_METHOD,
    async (params) => {
      const { chainId, assetAddress, iconUrl } = params as IAddAssetParams;
      const owner = options.getOwnerAddress();
      const [resolved, display] = await Promise.all([
        options.knownAssetRepository.resolveForTracking(
          chainId,
          assetAddress,
          owner,
        ),
        wallet.requestDisplay(),
      ]);
      const toPersist = iconUrl ? resolved.withIconUrl(iconUrl) : resolved;
      try {
        // Consent UI requires the flyout already open — keep sequential.
        if (
          !(await options.requestAddAssetApproval({
            chainId,
            assetAddress,
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
    },
    addAssetParamsSchema,
  );
}
