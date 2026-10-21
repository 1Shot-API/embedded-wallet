import {
  ChainUtils,
  ConversionUtils,
  OwsUnimplementedError,
  SolanaAccountAddress,
  type IOpenWalletSolanaProvider,
  type ISolanaGetAccountAddressParams,
  type ISolanaSignAndSendTransactionParams,
  type ISolanaSignInParams,
  type ISolanaSignInResult,
  type ISolanaSignMessageParams,
  type ISolanaSignMessageResult,
  type ISolanaSignTransactionParams,
  type OWSAnalyticsEvent,
  type SolanaSignature,
} from "@1shotapi/ows-types";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";

import { runWithAnalytics } from "../lib/implementations/utils/runWithAnalytics";
import { SIWSUtils } from "../lib/implementations/utils/SIWSUtils";
import type { IConfigProvider } from "../lib/interfaces/utils/IConfigProvider";
import type { IOWSProvider } from "../lib/interfaces/utils/IOWSProvider";
import {
  SolanaSignInCancelledEvent,
  SolanaSignInEvent,
  SolanaSignInFailedEvent,
  SolanaSignMessageCancelledEvent,
  SolanaSignMessageEvent,
  SolanaSignMessageFailedEvent,
} from "../lib/types/events/productEvents";
import { loadCachedSolanaAddress, saveCachedAddresses } from "../storage";
import type { ActiveModal } from "../wallet/modalTypes";
import { useWalletSessionStore } from "../wallet/sessionStore";

export type RegisterSolanaProviderOptions = {
  owsProvider: IOWSProvider;
  ensureReady: () => Promise<void>;
  ensureOnboardedForSigning: () => Promise<void>;
  configProvider: IConfigProvider;
  emitAnalytics: (event: OWSAnalyticsEvent) => void;
  ask: <T>(
    build: (handlers: {
      id: string;
      resolve: (value: T) => void;
      reject: (error: unknown) => void;
    }) => ActiveModal,
  ) => Promise<T>;
};

function unimplemented(method: string): never {
  throw new OwsUnimplementedError(
    `Solana ${method} is not implemented yet (Phase 6+)`,
  );
}

function sessionSolanaAddress(): SolanaAccountAddress | null {
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
  return null;
}

/**
 * Branding-side Solana wire — connect + signMessage + signIn; tx methods stubbed.
 */
export function registerSolanaProvider(
  wallet: OWSWallet,
  options: RegisterSolanaProviderOptions,
): void {
  const siwsUtils = new SIWSUtils();

  const resolveAccountAddress = async (
    _params?: ISolanaGetAccountAddressParams,
  ): Promise<SolanaAccountAddress> => {
    await options.ensureReady();

    const cached = sessionSolanaAddress();
    if (cached) {
      return cached;
    }

    const signer = await options.owsProvider.getSigner();
    const address = await signer.solana.getAccountAddress();
    const session = useWalletSessionStore.getState();
    session.setAddresses(session.evmAddress, address);
    saveCachedAddresses(session.evmAddress, address);
    return address;
  };

  const provider: IOpenWalletSolanaProvider = {
    getAccountAddress: resolveAccountAddress,

    async signMessage(
      params: ISolanaSignMessageParams,
    ): Promise<ISolanaSignMessageResult> {
      await options.ensureOnboardedForSigning();
      const owsWallet = await options.owsProvider.getWallet();
      const display = await owsWallet.requestDisplay();
      try {
        const { hostDomain } = await options.configProvider.getConfig();
        const started = performance.now();
        const address = await resolveAccountAddress();
        const messages = params.messages.map((encoded) =>
          ConversionUtils.base64ToBytes(encoded),
        );

        const signatures = await runWithAnalytics(
          options.emitAnalytics,
          () =>
            options.ask<SolanaSignature[]>(({ id, resolve, reject }) => ({
              id,
              kind: "solanaSign",
              address,
              messages,
              resolve,
              reject,
            })),
          {
            success: () =>
              new SolanaSignMessageEvent(
                hostDomain,
                address,
                messages.length,
                Math.round(performance.now() - started),
              ),
            cancelled: () =>
              new SolanaSignMessageCancelledEvent(
                hostDomain,
                address,
                Math.round(performance.now() - started),
              ),
            failed: (errorCode) =>
              new SolanaSignMessageFailedEvent(
                hostDomain,
                address,
                errorCode,
                Math.round(performance.now() - started),
              ),
          },
        );

        return { signatures };
      } finally {
        display.release();
      }
    },

    async signTransaction(_params: ISolanaSignTransactionParams) {
      unimplemented("signTransaction");
    },

    async signAndSendTransaction(
      _params: ISolanaSignAndSendTransactionParams,
    ) {
      unimplemented("signAndSendTransaction");
    },

    async signIn(params?: ISolanaSignInParams): Promise<ISolanaSignInResult> {
      await options.ensureOnboardedForSigning();
      const owsWallet = await options.owsProvider.getWallet();
      const display = await owsWallet.requestDisplay();
      try {
        const { hostDomain } = await options.configProvider.getConfig();
        const started = performance.now();
        const address = await resolveAccountAddress();
        const sessionChainId = useWalletSessionStore.getState().chainId;
        const fields = siwsUtils.resolveFields({
          input: params,
          hostDomain: String(hostDomain),
          accountAddress: address,
          sessionChainId: ChainUtils.isSolanaChainId(sessionChainId)
            ? sessionChainId
            : null,
        });
        const messageBytes = siwsUtils.messageBytes(fields);
        const signedMessage = ConversionUtils.bytesToBase64(messageBytes);

        const signature = await runWithAnalytics(
          options.emitAnalytics,
          () =>
            options.ask<SolanaSignature>(({ id, resolve, reject }) => ({
              id,
              kind: "siws",
              fields,
              messageBytes,
              resolve,
              reject,
            })),
          {
            success: () =>
              new SolanaSignInEvent(
                hostDomain,
                fields.address,
                fields.domain,
                Math.round(performance.now() - started),
              ),
            cancelled: () =>
              new SolanaSignInCancelledEvent(
                hostDomain,
                fields.address,
                Math.round(performance.now() - started),
              ),
            failed: (errorCode) =>
              new SolanaSignInFailedEvent(
                hostDomain,
                fields.address,
                errorCode,
                Math.round(performance.now() - started),
              ),
          },
        );

        return {
          account: fields.address,
          signedMessage,
          signature,
        };
      } finally {
        display.release();
      }
    },
  };

  wallet.solana.register(provider);
}
