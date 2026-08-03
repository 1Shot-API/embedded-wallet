import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  CredentialsHelper,
  type CredentialsHelperOptions,
} from "@1shotapi/ows-oid4";
import {
  type CredentialOfferApprovalRequest,
  type CredentialOfferInput,
  type CredentialPresentationApprovalRequest,
  type ICredentialRepository,
  type ICredentialStatusValidator,
  type IHolderSigner,
  type IIssuerTrustRegistry,
  type IOid4vciClient,
  type IOid4vpClient,
  type IWalletAttestationProvider,
  type IssuerMetadata,
  type OWSAnalyticsEvent,
  type PresentationRequestInput,
} from "@1shotapi/ows-types";
import { runWithAnalytics } from "../lib/implementations/utils";
import type { IConfigProvider } from "../lib/interfaces/utils";
import {
  CredentialIssueCancelledEvent,
  CredentialIssuedEvent,
  CredentialIssueFailedEvent,
  CredentialPresentCancelledEvent,
  CredentialPresentedEvent,
  CredentialPresentFailedEvent,
} from "../lib/types/events/productEvents";
import { isWalletCreated } from "../storage";
import {
  ensureCredentialsReadable,
  withWalletReady,
} from "../wallet/withWalletReady";

export type RegisterCredentialsProviderOptions = {
  repository: ICredentialRepository;
  oid4vci: IOid4vciClient;
  oid4vp: IOid4vpClient;
  trust: IIssuerTrustRegistry;
  status?: ICredentialStatusValidator;
  holderSigner?: IHolderSigner | (() => Promise<IHolderSigner>);
  getProofNonce?: (metadata: IssuerMetadata) => string | Promise<string>;
  attestationProvider?: IWalletAttestationProvider;
  ensureReady?: () => Promise<void>;
  requestCredentialOfferApproval?: (
    request: CredentialOfferApprovalRequest,
  ) => Promise<boolean>;
  requestCredentialPresentationApproval?: (
    request: CredentialPresentationApprovalRequest,
  ) => Promise<boolean>;
  /** Optional branding analytics sink for issue / present outcomes. */
  emitAnalytics?: (event: OWSAnalyticsEvent) => void;
  /** Required when `emitAnalytics` is set — supplies cached `hostDomain`. */
  configProvider?: IConfigProvider;
};

function originFromMaybeUri(value: string | undefined): string {
  if (!value) {
    return "unknown";
  }
  try {
    return new URL(value).hostname || "unknown";
  } catch {
    return "unknown";
  }
}

function issuerOriginFromOfferInput(input: CredentialOfferInput): string {
  const fromUri = originFromMaybeUri(input.credentialOfferUri);
  if (fromUri !== "unknown") {
    return fromUri;
  }
  return originFromMaybeUri(input.offer?.credentialIssuer);
}

function verifierOriginFromPresentInput(
  input: PresentationRequestInput,
): string {
  return originFromMaybeUri(input.requestUri);
}

/**
 * Register wallet.credentials handlers via {@link CredentialsHelper}
 * (call before `wallet.start()`).
 *
 * Host actions are gated so a locked / first-visit wallet unlocks (or runs
 * setup) before OID4 work. See {@link withWalletReady} /
 * {@link ensureCredentialsReadable}.
 */
export function registerCredentialsProvider(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterCredentialsProviderOptions,
): CredentialsHelper {
  const ensureReady = options.ensureReady ?? (async () => {});
  const emitAnalytics = options.emitAnalytics;
  const configProvider = options.configProvider;

  const helperOptions: CredentialsHelperOptions = {
    repository: options.repository,
    oid4vci: options.oid4vci,
    oid4vp: options.oid4vp,
    trust: options.trust,
    status: options.status,
    holderSigner: options.holderSigner,
    getProofNonce: options.getProofNonce,
    attestationProvider: options.attestationProvider,
    ensureReady,
    requestCredentialOfferApproval: options.requestCredentialOfferApproval,
    requestCredentialPresentationApproval:
      options.requestCredentialPresentationApproval,
  };
  const helper = new CredentialsHelper(wallet, signer, helperOptions);

  const acceptOffer = async (input: CredentialOfferInput) => {
    if (!emitAnalytics || !configProvider) {
      return helper.handlers.acceptOffer(input);
    }
    const { hostDomain } = await configProvider.getConfig();
    const issuerOrigin = issuerOriginFromOfferInput(input);
    const started = performance.now();
    return runWithAnalytics(
      emitAnalytics,
      () => helper.handlers.acceptOffer(input),
      {
        success: () =>
          new CredentialIssuedEvent(
            hostDomain,
            issuerOrigin,
            Math.round(performance.now() - started),
          ),
        cancelled: () =>
          new CredentialIssueCancelledEvent(
            hostDomain,
            Math.round(performance.now() - started),
            issuerOrigin === "unknown" ? null : issuerOrigin,
          ),
        failed: (errorCode) =>
          new CredentialIssueFailedEvent(
            hostDomain,
            errorCode,
            Math.round(performance.now() - started),
            issuerOrigin === "unknown" ? null : issuerOrigin,
          ),
      },
    );
  };

  const present = async (input: PresentationRequestInput) => {
    if (!emitAnalytics || !configProvider) {
      return helper.handlers.present(input);
    }
    const { hostDomain } = await configProvider.getConfig();
    const verifierOrigin = verifierOriginFromPresentInput(input);
    const started = performance.now();
    return runWithAnalytics(
      emitAnalytics,
      () => helper.handlers.present(input),
      {
        success: () =>
          new CredentialPresentedEvent(
            hostDomain,
            verifierOrigin,
            Math.round(performance.now() - started),
          ),
        cancelled: () =>
          new CredentialPresentCancelledEvent(
            hostDomain,
            Math.round(performance.now() - started),
            verifierOrigin === "unknown" ? null : verifierOrigin,
          ),
        failed: (errorCode) =>
          new CredentialPresentFailedEvent(
            hostDomain,
            errorCode,
            Math.round(performance.now() - started),
            verifierOrigin === "unknown" ? null : verifierOrigin,
          ),
      },
    );
  };

  // Gate at registration time so every credentials.* host call unlocks first
  // when needed — including future helpers that forget an internal ensureReady.
  wallet.credentials.register({
    acceptOffer: withWalletReady(ensureReady, (input) => acceptOffer(input)),
    present: async (input) => {
      await ensureCredentialsReadable({
        ensureReady,
        isWalletCreated,
        listLocal: () => options.repository.list(),
      });
      return present(input);
    },
    list: (filter) => helper.handlers.list(filter),
    delete: withWalletReady(ensureReady, (input) =>
      helper.handlers.delete(input),
    ),
  });

  return helper;
}
