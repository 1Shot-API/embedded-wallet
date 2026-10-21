import {
  OwsUnimplementedError,
  SolanaAccountAddress,
  type IOpenWalletSolanaProvider,
  type ISolanaGetAccountAddressParams,
  type ISolanaSignAndSendTransactionParams,
  type ISolanaSignInParams,
  type ISolanaSignMessageParams,
  type ISolanaSignTransactionParams,
} from "@1shotapi/ows-types";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";

import type { IOWSProvider } from "../lib/interfaces/utils/IOWSProvider";
import { loadCachedSolanaAddress, saveCachedAddresses } from "../storage";
import { useWalletSessionStore } from "../wallet/sessionStore";

export type RegisterSolanaProviderOptions = {
  owsProvider: IOWSProvider;
  ensureReady: () => Promise<void>;
};

function unimplemented(method: string): never {
  throw new OwsUnimplementedError(
    `Solana ${method} is not implemented yet (Phase 2 connect stub)`,
  );
}

/**
 * Branding-side Solana wire — Phase 2: `getAccountAddress` for Wallet Standard
 * connect; other methods stubbed until Phases 4–6.
 */
export function registerSolanaProvider(
  wallet: OWSWallet,
  options: RegisterSolanaProviderOptions,
): void {
  const provider: IOpenWalletSolanaProvider = {
    async getAccountAddress(_params?: ISolanaGetAccountAddressParams) {
      await options.ensureReady();

      const session = useWalletSessionStore.getState();
      const cached = session.solanaAddress;
      if (cached && cached !== SolanaAccountAddress("—")) {
        return cached;
      }

      const fromStorage = loadCachedSolanaAddress();
      if (fromStorage && fromStorage !== SolanaAccountAddress("—")) {
        session.setAddresses(session.evmAddress, fromStorage);
        return fromStorage;
      }

      const signer = await options.owsProvider.getSigner();
      const address = await signer.solana.getAccountAddress();
      session.setAddresses(session.evmAddress, address);
      saveCachedAddresses(session.evmAddress, address);
      return address;
    },

    async signMessage(_params: ISolanaSignMessageParams) {
      unimplemented("signMessage");
    },

    async signTransaction(_params: ISolanaSignTransactionParams) {
      unimplemented("signTransaction");
    },

    async signAndSendTransaction(
      _params: ISolanaSignAndSendTransactionParams,
    ) {
      unimplemented("signAndSendTransaction");
    },

    async signIn(_params?: ISolanaSignInParams) {
      unimplemented("signIn");
    },
  };

  wallet.solana.register(provider);
}
