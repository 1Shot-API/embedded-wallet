import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  CredentialsHelper,
  type CredentialsHelperOptions,
} from "@1shotapi/ows-oid4";
import {
  type CredentialOfferApprovalRequest,
  type CredentialPresentationApprovalRequest,
  type ICredentialRepository,
  type ICredentialStatusValidator,
  type IHolderSigner,
  type IIssuerTrustRegistry,
  type IOid4vciClient,
  type IOid4vpClient,
  type IWalletAttestationProvider,
  type IssuerMetadata,
} from "@1shotapi/ows-types";
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
};

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

  // Gate at registration time so every credentials.* host call unlocks first
  // when needed — including future helpers that forget an internal ensureReady.
  wallet.credentials.register({
    acceptOffer: withWalletReady(ensureReady, (input) =>
      helper.handlers.acceptOffer(input),
    ),
    present: async (input) => {
      await ensureCredentialsReadable({
        ensureReady,
        isWalletCreated,
        listLocal: () => options.repository.list(),
      });
      return helper.handlers.present(input);
    },
    list: (filter) => helper.handlers.list(filter),
    delete: withWalletReady(ensureReady, (input) =>
      helper.handlers.delete(input),
    ),
  });

  return helper;
}
