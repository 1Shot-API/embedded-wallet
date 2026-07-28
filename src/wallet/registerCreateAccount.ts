import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import type { COSEPublicKey, CredentialId, EVMAccountAddress } from "@1shotapi/ows-types";
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
      /**
       * Safari `/create` path: WebAuthn registration only (no PRF unlock, no
       * relayer register). Opener finishes those ceremonies after handoff.
       */
      registrationOnly: z.boolean().optional(),
    })
    .strict(),
);

export type ICreateAccountParams = z.infer<typeof createAccountParamsSchema>;

export type ICreateAccountResult = {
  ok: true;
  credentialId: CredentialId;
  /** Present when `registrationOnly` — needed for opener relayer register. */
  cosePublicKey?: COSEPublicKey;
  accounts: EVMAccountAddress[];
};

export type IPasskeyRegistrationResult = {
  credentialId: CredentialId;
  cosePublicKey: COSEPublicKey;
};

export type RegisterCreateAccountOptions = {
  displaySize: IWalletDisplaySize;
  /** Named create (skips PasskeyNameModal). Full create + register. */
  createNewWallet: (accountName: string) => Promise<void>;
  /** Full UI create (name modal + create). */
  createNewWalletFromUi: () => Promise<void>;
  /** Registration-only create for first-party `/create` handoff. */
  createPasskeyRegistrationOnly: (
    accountName?: string,
  ) => Promise<IPasskeyRegistrationResult>;
};

/**
 * Register host `createAccount` RPC for the first-party `/create` page
 * (and optional host-driven create).
 */
export function registerCreateAccountRpc(
  wallet: OWSWallet,
  options: RegisterCreateAccountOptions,
): void {
  wallet.registerRpc(
    CREATE_ACCOUNT_RPC_METHOD,
    async (params) => {
      const { accountName, registrationOnly } = params as ICreateAccountParams;
      const display = await wallet.requestDisplay(options.displaySize);
      try {
        if (registrationOnly) {
          const registered =
            await options.createPasskeyRegistrationOnly(accountName);
          return {
            ok: true as const,
            credentialId: registered.credentialId,
            cosePublicKey: registered.cosePublicKey,
            accounts: [] as EVMAccountAddress[],
          } satisfies ICreateAccountResult;
        }

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
