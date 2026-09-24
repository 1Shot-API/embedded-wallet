import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  HexString,
  HexStringSchema,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  type EVMAccountAddress,
  type EVMChainId,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import type { IConfigProvider } from "../lib/interfaces/utils/IConfigProvider";
import type { IDelegationService } from "../lib/interfaces/business/IDelegationService";
import type { SupportedChain } from "../lib/types/domain";
import type { IStoredDelegation } from "../lib/types/domain/StoredDelegation";
import type { ActiveModal } from "./modalTypes";
import { loadCachedEvmAddress } from "../storage";
import { useWalletSessionStore } from "./sessionStore";

/** Custom RPC — host: `await proxy.rpc("requestCancelDelegations", { permissionContexts })`. */
export const REQUEST_CANCEL_DELEGATIONS_RPC_METHOD =
  "requestCancelDelegations";

const requestCancelDelegationsParamsSchema = z.strictObject({
  permissionContexts: z.array(HexStringSchema).min(1),
});

export type IRequestCancelDelegationsParams = z.infer<
  typeof requestCancelDelegationsParamsSchema
>;

export type IRequestCancelDelegationsResult = {
  /** Null when the user skipped on-chain cancellation. */
  transactionHashes: EVMTransactionHash[] | null;
};

export type RegisterRequestCancelDelegationsOptions = {
  configProvider: IConfigProvider;
  delegationService: IDelegationService;
  ensureOnboardedForSigning: () => Promise<void>;
  resolveChain: (chainId: EVMChainId) => SupportedChain | null;
  ask: <T>(
    build: (handlers: {
      id: string;
      resolve: (value: T) => void;
      reject: (error: unknown) => void;
    }) => ActiveModal,
  ) => Promise<T>;
};

/**
 * Register host `requestCancelDelegations` — opens the batch cancel modal for
 * permission contexts previously returned from
 * `wallet_requestExecutionPermissions`. Only delegations granted to the
 * calling host's domain are accepted.
 */
export function registerRequestCancelDelegationsRpc(
  wallet: OWSWallet,
  options: RegisterRequestCancelDelegationsOptions,
): void {
  wallet.registerRpc(
    REQUEST_CANCEL_DELEGATIONS_RPC_METHOD,
    async (params) => {
      const { permissionContexts } =
        params as IRequestCancelDelegationsParams;

      await options.ensureOnboardedForSigning();

      const { hostDomain: callerDomain } =
        await options.configProvider.getConfig();
      const callerKey = String(callerDomain).toLowerCase();

      const storedList: IStoredDelegation[] = [];
      for (const raw of permissionContexts) {
        const permissionContext = HexString(
          String(raw) as `0x${string}`,
        );
        const stored =
          await options.delegationService.findByPermissionContext(
            permissionContext,
          );
        if (!stored) {
          throw new OwsInvalidParamsError(
            "Unknown permissionContext — grant must exist in this wallet vault",
          );
        }
        if (String(stored.hostDomain).toLowerCase() !== callerKey) {
          throw new OwsInvalidParamsError(
            "Cannot cancel a permission granted to a different host",
          );
        }
        storedList.push(stored);
      }

      for (const stored of storedList) {
        const chain = options.resolveChain(stored.chainId);
        if (!chain?.useRelayer) {
          throw new OwsInvalidParamsError(
            `Chain ${stored.chainId} does not support canceling permissions`,
          );
        }
      }

      const owner =
        useWalletSessionStore.getState().evmAddress ||
        loadCachedEvmAddress();
      if (!owner) {
        throw new OwsInvalidParamsError(
          "Wallet address is required to cancel a permission",
        );
      }

      const items = await Promise.all(
        storedList.map(async (stored) => {
          const chain = options.resolveChain(stored.chainId)!;
          const work = await options.delegationService.buildCancelWork({
            chainId: stored.chainId,
            stored,
          });
          return {
            memo: stored.memo,
            chainName: chain.label,
            chainId: stored.chainId,
            work,
          };
        }),
      );

      const display = await wallet.requestDisplay();
      try {
        const transactionHashes = await options.ask<
          EVMTransactionHash[] | null
        >(({ id, resolve, reject }) => ({
          id,
          kind: "cancelDelegation",
          request: {
            domain: String(callerDomain),
            ownerAddress: owner as EVMAccountAddress,
            items,
            allowSkipOnchain: true,
          },
          execute: async (payment, ui) => {
            const batch = await options.delegationService.cancelDelegations({
              items: storedList.map((stored) => ({
                chainId: stored.chainId,
                stored,
              })),
              paymentToken: payment.paymentToken,
              feeAtoms: payment.feeAtoms,
              paymentChainId: payment.paymentChainId,
              ...ui,
            });
            return batch.results.map((r) => r.transactionHash);
          },
          executeLocal: async () => {
            await options.delegationService.removeStoredDelegations(
              storedList,
            );
          },
          resolve,
          reject,
        }));

        return {
          transactionHashes,
        } satisfies IRequestCancelDelegationsResult;
      } catch (error: unknown) {
        if (
          error instanceof OwsUserRejectedError ||
          (error instanceof Error && /reject/i.test(error.message))
        ) {
          throw error instanceof OwsUserRejectedError
            ? error
            : new OwsUserRejectedError("User rejected canceling permissions");
        }
        throw error;
      } finally {
        await display.hide();
      }
    },
    requestCancelDelegationsParamsSchema,
  );
}
