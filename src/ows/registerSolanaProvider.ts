import {
  ChainUtils,
  ConversionUtils,
  OwsInvalidParamsError,
  SolanaAccountAddress,
  type IOpenWalletSolanaProvider,
  type ISolanaGetAccountAddressParams,
  type ISolanaSignAndSendTransactionParams,
  type ISolanaSignAndSendTransactionResult,
  type ISolanaSignInParams,
  type ISolanaSignInResult,
  type ISolanaSignMessageParams,
  type ISolanaSignMessageResult,
  type ISolanaSignTransactionParams,
  type ISolanaSignTransactionResult,
  type OWSAnalyticsEvent,
  type SolanaChainId,
  type SolanaSignature,
  type SolanaTransactionSignature,
} from "@1shotapi/ows-types";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";

import { runWithAnalytics } from "../lib/implementations/utils/runWithAnalytics";
import { SIWSUtils } from "../lib/implementations/utils/SIWSUtils";
import {
  SOLANA_TX_MAX_BATCH,
  SolanaTxUtils,
  type ISolanaTxSummary,
} from "../lib/implementations/utils/SolanaTxUtils";
import type { ISolanaRpc } from "../lib/interfaces/data/ISolanaRpc";
import type { IConfigProvider } from "../lib/interfaces/utils/IConfigProvider";
import type { IOWSProvider } from "../lib/interfaces/utils/IOWSProvider";
import {
  SolanaSignAndSendCancelledEvent,
  SolanaSignAndSendEvent,
  SolanaSignAndSendFailedEvent,
  SolanaSignInCancelledEvent,
  SolanaSignInEvent,
  SolanaSignInFailedEvent,
  SolanaSignMessageCancelledEvent,
  SolanaSignMessageEvent,
  SolanaSignMessageFailedEvent,
  SolanaSignTransactionCancelledEvent,
  SolanaSignTransactionEvent,
  SolanaSignTransactionFailedEvent,
} from "../lib/types/events/productEvents";
import { loadCachedSolanaAddress, saveCachedAddresses } from "../storage";
import { styleController } from "../style/styleController";
import type { ActiveModal } from "../wallet/modalTypes";
import { useWalletSessionStore } from "../wallet/sessionStore";

export type RegisterSolanaProviderOptions = {
  owsProvider: IOWSProvider;
  ensureReady: () => Promise<void>;
  ensureOnboardedForSigning: () => Promise<void>;
  configProvider: IConfigProvider;
  solanaRpc: ISolanaRpc;
  emitAnalytics: (event: OWSAnalyticsEvent) => void;
  ask: <T>(
    build: (handlers: {
      id: string;
      resolve: (value: T) => void;
      reject: (error: unknown) => void;
    }) => ActiveModal,
  ) => Promise<T>;
};

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

function resolveSolanaCluster(
  requested: SolanaChainId | undefined,
): SolanaChainId {
  const sessionChainId = useWalletSessionStore.getState().chainId;
  if (!ChainUtils.isSolanaChainId(sessionChainId)) {
    throw new OwsInvalidParamsError(
      "Switch the wallet to a Solana cluster before signing Solana transactions",
    );
  }
  if (requested !== undefined && requested !== sessionChainId) {
    throw new OwsInvalidParamsError(
      `Transaction cluster ${requested} does not match wallet cluster ${sessionChainId}`,
    );
  }
  return sessionChainId;
}

/**
 * Branding-side Solana wire — connect, messages, SIWS, and transaction
 * sign / sign-and-send (Alchemy submit).
 */
export function registerSolanaProvider(
  wallet: OWSWallet,
  options: RegisterSolanaProviderOptions,
): void {
  const siwsUtils = new SIWSUtils();
  const txUtils = new SolanaTxUtils();

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

  const buildConsentPayload = async (
    messageBytesList: readonly Uint8Array[],
    address: SolanaAccountAddress,
    chainId: SolanaChainId,
    copy: {
      simulationWarning: string;
      durableNonceWarning: string;
    },
  ): Promise<{
    summaries: ISolanaTxSummary[];
    warnings: string[];
  }> => {
    const summaries = messageBytesList.map((bytes) => {
      const summary = txUtils.summarize(bytes);
      txUtils.assertSignable(summary, address);
      return summary;
    });

    const warnings: string[] = [];
    if (summaries.some((s) => s.hasDurableNonce)) {
      warnings.push(copy.durableNonceWarning);
    }

    for (const bytes of messageBytesList) {
      try {
        const unsignedWire = txUtils.buildWireBase64(bytes, address, null);
        const sim = await options.solanaRpc.simulateTransaction(
          chainId,
          unsignedWire,
        );
        if (sim.err != null) {
          warnings.push(copy.simulationWarning);
          break;
        }
      } catch {
        warnings.push(copy.simulationWarning);
        break;
      }
    }

    return { summaries, warnings };
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

    async signTransaction(
      params: ISolanaSignTransactionParams,
    ): Promise<ISolanaSignTransactionResult> {
      await options.ensureOnboardedForSigning();
      if (params.transactions.length === 0) {
        throw new OwsInvalidParamsError("transactions must not be empty");
      }
      if (params.transactions.length > SOLANA_TX_MAX_BATCH) {
        throw new OwsInvalidParamsError(
          `At most ${SOLANA_TX_MAX_BATCH} transactions per signTransaction request`,
        );
      }

      const owsWallet = await options.owsProvider.getWallet();
      const display = await owsWallet.requestDisplay();
      try {
        const { hostDomain } = await options.configProvider.getConfig();
        const copy = styleController.get().copy.solanaSignAndSend;
        const started = performance.now();
        const address = await resolveAccountAddress();
        const chainId = resolveSolanaCluster(undefined);
        const messageBytesList = params.transactions.map((encoded) =>
          txUtils.messageBytesFromBase64(encoded),
        );
        const { summaries, warnings } = await buildConsentPayload(
          messageBytesList,
          address,
          chainId,
          copy,
        );

        const signatures = await runWithAnalytics(
          options.emitAnalytics,
          () =>
            options.ask<SolanaSignature[]>(({ id, resolve, reject }) => ({
              id,
              kind: "solanaSignAndSend",
              mode: "sign",
              chainId,
              address,
              summaries,
              messageBytesList,
              warnings,
              resolve: (value) => {
                if (typeof value === "string") {
                  reject(new Error("Unexpected transaction signature result"));
                  return;
                }
                resolve(value);
              },
              reject,
            })),
          {
            success: () =>
              new SolanaSignTransactionEvent(
                hostDomain,
                address,
                chainId,
                messageBytesList.length,
                Math.round(performance.now() - started),
              ),
            cancelled: () =>
              new SolanaSignTransactionCancelledEvent(
                hostDomain,
                address,
                chainId,
                Math.round(performance.now() - started),
              ),
            failed: (errorCode) =>
              new SolanaSignTransactionFailedEvent(
                hostDomain,
                address,
                chainId,
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

    async signAndSendTransaction(
      params: ISolanaSignAndSendTransactionParams,
    ): Promise<ISolanaSignAndSendTransactionResult> {
      await options.ensureOnboardedForSigning();
      const owsWallet = await options.owsProvider.getWallet();
      const display = await owsWallet.requestDisplay();
      try {
        const { hostDomain } = await options.configProvider.getConfig();
        const copy = styleController.get().copy.solanaSignAndSend;
        const started = performance.now();
        const address = await resolveAccountAddress();
        const chainId = resolveSolanaCluster(params.chainId);
        const messageBytes = txUtils.messageBytesFromBase64(params.transaction);
        const { summaries, warnings } = await buildConsentPayload(
          [messageBytes],
          address,
          chainId,
          copy,
        );

        let submittedSignature: SolanaTransactionSignature | null = null;

        const signature = await runWithAnalytics(
          options.emitAnalytics,
          () =>
            options.ask<SolanaTransactionSignature>(
              ({ id, resolve, reject }) => ({
                id,
                kind: "solanaSignAndSend",
                mode: "signAndSend",
                chainId,
                address,
                summaries,
                messageBytesList: [messageBytes],
                warnings,
                submit: async (bytes, signatureBytes) => {
                  const wire = txUtils.buildWireBase64(
                    bytes,
                    address,
                    signatureBytes,
                  );
                  const txSignature =
                    await options.solanaRpc.sendRawTransaction(chainId, wire);
                  submittedSignature = txSignature;
                  return txSignature;
                },
                resolve: (value) => {
                  if (typeof value !== "string") {
                    reject(new Error("Unexpected signature-array result"));
                    return;
                  }
                  resolve(value);
                },
                reject,
              }),
            ),
          {
            success: () =>
              new SolanaSignAndSendEvent(
                hostDomain,
                address,
                chainId,
                submittedSignature!,
                Math.round(performance.now() - started),
              ),
            cancelled: () =>
              new SolanaSignAndSendCancelledEvent(
                hostDomain,
                address,
                chainId,
                Math.round(performance.now() - started),
              ),
            failed: (errorCode) =>
              new SolanaSignAndSendFailedEvent(
                hostDomain,
                address,
                chainId,
                errorCode,
                Math.round(performance.now() - started),
              ),
          },
        );

        return { signature };
      } finally {
        display.release();
      }
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
