import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  OwsUserRejectedError,
  type EVMAccountAddress,
} from "@1shotapi/ows-types";
import { openOnramp } from "../circle/openOnramp";

/** Custom RPC — host: `await proxy.rpc("onramp", { chainId?, amount? })`. */
export const ONRAMP_RPC_METHOD = "onramp";

const onrampParamsSchema = z
  .strictObject({
    chainId: z.number().int().positive().optional(),
    amount: z.string().min(1).optional(),
  })
  .default({});

export type IOnrampParams = z.infer<typeof onrampParamsSchema>;

export type RegisterOnrampOptions = {
  getOwnerAddress: () => EVMAccountAddress | null;
};

/**
 * Register host `onramp` RPC — opens Circle onramp fullscreen for the
 * unlocked EVM address.
 */
export function registerOnrampRpc(
  wallet: OWSWallet,
  options: RegisterOnrampOptions,
): void {
  wallet.registerRpc(
    ONRAMP_RPC_METHOD,
    async (params) => {
      const { chainId, amount } = params as IOnrampParams;
      const owner = options.getOwnerAddress();
      if (!owner) {
        throw new Error("Wallet is locked — unlock before onramp");
      }

      const display = await wallet.requestDisplay();
      try {
        await openOnramp({
          destinationAddress: owner,
          chainId,
          amount,
        });
        return { ok: true as const };
      } catch (error: unknown) {
        if (
          error instanceof OwsUserRejectedError ||
          (error instanceof Error && /reject/i.test(error.message))
        ) {
          throw error instanceof OwsUserRejectedError
            ? error
            : new OwsUserRejectedError("User closed onramp");
        }
        throw error;
      } finally {
        await display.hide();
      }
    },
    onrampParamsSchema,
  );
}
