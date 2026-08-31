import { EVMChainId } from "@1shotapi/ows-types";
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
        const catalogIds = new Set(
          chainRepository
            .getCatalog()
            .map((chain) => String(chain.chainId).toLowerCase()),
        );
        const valid: ReturnType<typeof EVMChainId>[] = [];
        for (const id of configureParams.features.allowedChains) {
          const lower = id.toLowerCase();
          if (catalogIds.has(lower)) {
            valid.push(EVMChainId(lower as `0x${string}`));
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
