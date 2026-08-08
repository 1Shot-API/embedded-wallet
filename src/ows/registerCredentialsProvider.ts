import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  CredentialsHelper,
  createCredentialsHolderSigner,
  issueCredentialAfterApproval,
  presentCredentialAfterApproval,
  type ApproveAndAcceptOfferRequest,
  type ApproveAndPresentRequest,
} from "@1shotapi/ows-oid4";
import {
  OwsUserRejectedError,
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
  /**
   * Full unlock/setup — empty-vault present recover and credential delete.
   */
  ensureReady?: () => Promise<void>;
  /**
   * Setup-only when no credential exists. With a known passkey, skip unlock —
   * the PoP ceremony authenticates. Pair with {@link onAuthenticated}.
   */
  ensureOnboarded?: () => Promise<void>;
  /** Mark unlocked after a successful PoP / issue ceremony. */
  onAuthenticated?: () => void | Promise<void>;
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
 * Register `wallet.credentials` via {@link CredentialsHelper} (pre-`start()`).
 *
 * Helper resolves/match/trust + display. Branding `approveAnd*` owns consent,
 * setup, and PoP. Empty-vault present still uses {@link ensureCredentialsReadable}.
 */
export function registerCredentialsProvider(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterCredentialsProviderOptions,
): CredentialsHelper {
  const ensureReady = options.ensureReady ?? (async () => {});
  const ensureOnboarded =
    options.ensureOnboarded ?? options.ensureReady ?? (async () => {});
  const emitAnalytics = options.emitAnalytics;
  const configProvider = options.configProvider;
  const resolveHolderSigner = createCredentialsHolderSigner(
    signer,
    options.holderSigner,
  );

  const approveAndAcceptOffer = async (
    request: ApproveAndAcceptOfferRequest,
  ) => {
    await ensureOnboarded();
    if (options.requestCredentialOfferApproval) {
      const approved = await options.requestCredentialOfferApproval(request);
      if (!approved) {
        throw new OwsUserRejectedError("User rejected credential offer");
      }
    }
    const receipt = await issueCredentialAfterApproval({
      offer: request.offer,
      metadata: request.metadata,
      oid4vci: options.oid4vci,
      repository: options.repository,
      resolveHolderSigner,
      getProofNonce: options.getProofNonce,
      attestationProvider: options.attestationProvider,
      status: options.status,
    });
    await options.onAuthenticated?.();
    return receipt;
  };

  const approveAndPresent = async (request: ApproveAndPresentRequest) => {
    if (options.requestCredentialPresentationApproval) {
      const approved =
        await options.requestCredentialPresentationApproval(request);
      if (!approved) {
        throw new OwsUserRejectedError("User rejected credential presentation");
      }
    }
    const result = await presentCredentialAfterApproval({
      definition: request.definition,
      credential: request.credential,
      oid4vp: options.oid4vp,
      resolveHolderSigner,
      attestationProvider: options.attestationProvider,
    });
    await options.onAuthenticated?.();
    return result;
  };

  const helper = new CredentialsHelper(wallet, {
    repository: options.repository,
    oid4vci: options.oid4vci,
    oid4vp: options.oid4vp,
    trust: options.trust,
    status: options.status,
    approveAndAcceptOffer,
    approveAndPresent,
  });

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

  wallet.credentials.register({
    // Do not full-unlock before display — approveAndAcceptOffer opens under
    // requestDisplay and uses setup-only / PoP.
    acceptOffer: (input) => acceptOffer(input),
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
