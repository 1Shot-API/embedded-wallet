import {
  ChainUtils,
  type OWSChainId,
} from "@1shotapi/ows-types";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import type { IChainRepository } from "../lib/interfaces/data/IChainRepository";
import {
  configureParamsSchema,
  type IConfigureParams,
} from "./configureSchemas";
import { styleController } from "./styleController";

/** Custom RPC method name — host: `await proxy.rpc("configure", options)`. */
export const CONFIGURE_RPC_METHOD = "configure";

export { configureParamsSchema, type IConfigureParams };

export function registerConfigureRpc(
  wallet: OWSWallet,
  chainRepository: IChainRepository,
): void {
  wallet.registerRpc(
    CONFIGURE_RPC_METHOD,
    async (params) => {
      const configureParams = params as IConfigureParams;
      const resolved = styleController.merge(configureParams);
      if (configureParams.features?.allowedChains !== undefined) {
        const catalogByLower = new Map(
          chainRepository
            .getCatalog()
            .map((chain) => [String(chain.chainId).toLowerCase(), chain.chainId]),
        );
        const valid: OWSChainId[] = [];
        for (const id of configureParams.features.allowedChains) {
          const match = catalogByLower.get(String(id).toLowerCase());
          if (match === undefined) continue;
          if (
            ChainUtils.isBitcoinChainId(match) ||
            ChainUtils.isEVMChainId(match)
          ) {
            valid.push(match);
          }
        }
        chainRepository.setAllowedChains(valid.length === 0 ? null : valid);
      }
      return {
        ok: true as const,
        productName: resolved.copy.productName,
      };
    },
    configureParamsSchema,
  );
}
