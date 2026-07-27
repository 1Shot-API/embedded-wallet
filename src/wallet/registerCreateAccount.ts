import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import type { EVMAccountAddress } from "@1shotapi/ows-types";
import type { IWalletDisplaySize } from "../lib/types/domain";
import { loadCredentialId } from "../storage";
import { useWalletSessionStore } from "./sessionStore";

/** Custom RPC — host: `await proxy.rpc("createAccount", { accountName? })`. */
export const CREATE_ACCOUNT_RPC_METHOD = "createAccount";

const createAccountParamsSchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z
    .object({
      accountName: z.string().min(1).max(128).optional(),
    })
    .strict(),
);

export type ICreateAccountParams = z.infer<typeof createAccountParamsSchema>;

export type ICreateAccountResult = {
  ok: true;
  credentialId: string;
  accounts: EVMAccountAddress[];
};

export type RegisterCreateAccountOptions = {
  displaySize: IWalletDisplaySize;
  /** Named create (skips PasskeyNameModal). */
  createNewWallet: (accountName: string) => Promise<void>;
  /** Full UI create (name modal + create). */
  createNewWalletFromUi: () => Promise<void>;
};

/**
 * Register host `createAccount` RPC for the first-party `/create` page.
 * Runs the normal branding create path (passkey + relayer register).
 */
export function registerCreateAccountRpc(
  wallet: OWSWallet,
  options: RegisterCreateAccountOptions,
): void {
  wallet.registerRpc(
    CREATE_ACCOUNT_RPC_METHOD,
    async (params) => {
      const { accountName } = params as ICreateAccountParams;
      const display = await wallet.requestDisplay(options.displaySize);
      try {
        if (accountName) {
          await options.createNewWallet(accountName);
        } else {
          await options.createNewWalletFromUi();
        }

        const credentialId = loadCredentialId();
        if (!credentialId) {
          throw new Error("Account created but credential id missing");
        }

        const evm = useWalletSessionStore.getState().evmAddress;
        const accounts: EVMAccountAddress[] = evm ? [evm] : [];

        return {
          ok: true as const,
          credentialId,
          accounts,
        } satisfies ICreateAccountResult;
      } finally {
        await display.hide();
      }
    },
    createAccountParamsSchema,
  );
}
