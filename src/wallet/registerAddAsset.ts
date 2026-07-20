import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  EVMChainId,
  OwsUserRejectedError,
} from "@1shotapi/ows-types";
import type { IKnownAssetRepository } from "../assets/IKnownAssetRepository";
import type { ITrackedAssetRepository } from "../assets/ITrackedAssetRepository";
import { useWalletSessionStore } from "./sessionStore";

/** Custom RPC — host: `await proxy.rpc("addAsset", { chainId, assetAddress })`. */
export const ADD_ASSET_RPC_METHOD = "addAsset";

const addAssetParamsSchema = z
  .object({
    chainId: z
      .string()
      .regex(/^0x[0-9a-fA-F]+$/)
      .transform((value) => EVMChainId(value as `0x${string}`)),
    assetAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .transform((value) => EVMAccountAddress(value as `0x${string}`)),
  })
  .strict();

export type IAddAssetParams = z.infer<typeof addAssetParamsSchema>;

export interface IAddAssetApprovalRequest {
  chainId: EVMChainId;
  assetAddress: EVMAccountAddress;
  /** Known catalog name when available. */
  assetName: string | null;
}

export type RegisterAddAssetOptions = {
  knownAssetRepository: IKnownAssetRepository;
  trackedAssetRepository: ITrackedAssetRepository;
  requestAddAssetApproval: (
    request: IAddAssetApprovalRequest,
  ) => Promise<boolean>;
};

/**
 * Register host `addAsset` RPC (always requires user confirmation).
 * Must run after the modal ask helper exists and before `wallet.start()`.
 */
export function registerAddAssetRpc(
  wallet: OWSWallet,
  options: RegisterAddAssetOptions,
): void {
  wallet.registerRpc(
    ADD_ASSET_RPC_METHOD,
    async (params) => {
      const { chainId, assetAddress } = params as IAddAssetParams;
      const known = await options.knownAssetRepository.getKnownAsset(
        chainId,
        assetAddress,
      );

      const display = await wallet.requestDisplay({ width: 420, height: 360 });
      try {
        const approved = await options.requestAddAssetApproval({
          chainId,
          assetAddress,
          assetName: known?.name ?? null,
        });
        if (!approved) {
          throw new OwsUserRejectedError("User rejected add asset request");
        }

        await options.trackedAssetRepository.add({
          chainId,
          address: assetAddress,
        });
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
