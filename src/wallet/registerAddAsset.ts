import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  EVMChainId,
  OwsUserRejectedError,
  type EVMAccountAddress as EVMAccountAddressType,
} from "@1shotapi/ows-types";
import type {
  IKnownAssetRepository,
  ITrackedAssetRepository,
} from "../lib/interfaces/data";
import { useWalletSessionStore } from "./sessionStore";

/** Custom RPC — host: `await proxy.rpc("addAsset", { chainId, assetAddress })`. */
export const ADD_ASSET_RPC_METHOD = "addAsset";

const addAssetParamsSchema = z.strictObject({
    chainId: z
      .string()
      .regex(/^0x[0-9a-fA-F]+$/)
      .transform((value) => EVMChainId(value as `0x${string}`)),
    assetAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .transform((value) => EVMAccountAddress(value as `0x${string}`)),
  });

export type IAddAssetParams = z.infer<typeof addAssetParamsSchema>;

export interface IAddAssetApprovalRequest {
  chainId: EVMChainId;
  assetAddress: EVMAccountAddress;
  /** Resolved token name for the confirm modal. */
  assetName: string;
  assetSymbol: string;
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
      const { chainId, assetAddress } = params as IAddAssetParams;
      const owner = options.getOwnerAddress();
      const [resolved, display] = await Promise.all([
        options.knownAssetRepository.resolveForTracking(
          chainId,
          assetAddress,
          owner,
        ),
        wallet.requestDisplay(),
      ]);
      try {
        // Consent UI requires the flyout already open — keep sequential.
        if (
          !(await options.requestAddAssetApproval({
            chainId,
            assetAddress,
            assetName: resolved.name,
            assetSymbol: resolved.symbol,
          }))
        ) {
          throw new OwsUserRejectedError("User rejected add asset request");
        }

        await options.trackedAssetRepository.add(resolved, owner);
        const listed = await options.trackedAssetRepository.list(owner);
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
