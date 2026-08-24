/**
 * Host-facing branding / config knobs for `proxy.rpc("configure", options)`.
 * All fields optional — omitted keys keep the previous / default value.
 */
export interface IStyleThemeOptions {
  /** CSS color for --primary */
  primary?: string;
  /** CSS color for --primary-foreground */
  primaryForeground?: string;
  /** CSS color for --background */
  background?: string;
  /** CSS color for --foreground */
  foreground?: string;
  /** CSS color for --muted */
  muted?: string;
  /** CSS color for --muted-foreground */
  mutedForeground?: string;
  /** CSS color for --border */
  border?: string;
  /** CSS color for --accent */
  accent?: string;
  /** CSS color for --accent-foreground */
  accentForeground?: string;
  /** CSS length for --radius (e.g. "0.625rem") */
  radius?: string;
  /** CSS font-family for --font-sans */
  fontSans?: string;
}

/** Connect approval modal (`eth_requestAccounts` / connect consent). */
export interface IStyleCopyConnect {
  title: string;
  body: string;
  rejectLabel: string;
  continueLabel: string;
}

/** First-time / locked setup modal (login vs create). */
export interface IStyleCopyWalletSetup {
  title: string;
  body: string;
  cancelLabel: string;
  loginLabel: string;
  createLabel: string;
  /** Passkey ceremony timed out (e.g. Signer RPC `getPublicKey`). */
  passkeyTimeoutError: string;
  /** Generic passkey login/create failure after cancel or other errors. */
  passkeyFailedError: string;
}

/** Name passkey modal (create-account flow). */
export interface IStyleCopyPasskeyName {
  title: string;
  body: string;
  fieldLabel: string;
  placeholder: string;
  emptyError: string;
  termsAcceptancePrefix: string;
  termsOfServiceLabel: string;
  termsAcceptanceJoiner: string;
  privacyPolicyLabel: string;
  termsAcceptanceError: string;
  termsOfServiceUrl: string;
  privacyPolicyUrl: string;
  cancelLabel: string;
  continueLabel: string;
}

/** `personal_sign` / eth_sign message approval modal. */
export interface IStyleCopyPersonalSign {
  title: string;
  accountLabel: string;
  messageLabel: string;
  rejectLabel: string;
  signLabel: string;
}

/** EIP-4361 Sign-In with Ethereum consent modal. */
export interface IStyleCopySiwe {
  title: string;
  body: string;
  estimatedChangesLabel: string;
  noChangesLabel: string;
  networkLabel: string;
  requestFromLabel: string;
  signingInWithLabel: string;
  messageLabel: string;
  uriLabel: string;
  rejectLabel: string;
  signLabel: string;
  signingHint: string;
}

/** EIP-712 typed-data approval modal. */
export interface IStyleCopyTypedData {
  title: string;
  accountLabel: string;
  primaryTypeLabel: string;
  domainLabel: string;
  messageLabel: string;
  rejectLabel: string;
  signLabel: string;
}

/** `eth_sendTransaction` approval modal. */
export interface IStyleCopySendTransaction {
  title: string;
  accountLabel: string;
  contractLabel: string;
  contractCreationLabel: string;
  valueLabel: string;
  dataLabel: string;
  chainLabel: string;
  rejectLabel: string;
  signLabel: string;
}

/**
 * Friendly host ERC-20 transfer confirm.
 * `body` supports `{domain}`.
 */
export interface IStyleCopyConfirmTransfer {
  title: string;
  body: string;
  amountLabel: string;
  tokenLabel: string;
  receiverLabel: string;
  chainLabel: string;
  rejectLabel: string;
  confirmLabel: string;
}

/**
 * In-wallet send / transfer tokens modal (form + post-send confirmation).
 */
export interface IStyleCopyTransferTokens {
  title: string;
  body: string;
  amountLabel: string;
  amountPlaceholder: string;
  recipientLabel: string;
  recipientPlaceholder: string;
  scanQrLabel: string;
  cancelLabel: string;
  sendLabel: string;
  invalidAmountError: string;
  insufficientBalanceError: string;
  invalidAddressError: string;
  sendFailedError: string;
  /** Confirmation after a successful in-wallet send. */
  sentTitle: string;
  sentBody: string;
  hashLabel: string;
  copyHashLabel: string;
  hashCopiedLabel: string;
  hashCopyFailedLabel: string;
  viewOnExplorerLabel: string;
  doneLabel: string;
}

/**
 * EIP-7715 grant consent form (`wallet_requestExecutionPermissions`).
 * `body` supports `{domain}`, `{to}`, `{chainName}`, `{permissionType}`.
 */
export interface IStyleCopyGrantExecutionPermission {
  title: string;
  body: string;
  hostLabel: string;
  toLabel: string;
  chainLabel: string;
  permissionTypeLabel: string;
  tokenLabel: string;
  periodAmountLabel: string;
  periodAmountPlaceholder: string;
  periodDurationLabel: string;
  periodDurationPlaceholder: string;
  periodDurationHint: string;
  startLabel: string;
  memoLabel: string;
  memoPlaceholder: string;
  invalidAmountError: string;
  invalidDurationError: string;
  rejectLabel: string;
  grantLabel: string;
}

/**
 * On-chain cancel / revoke confirm (Delegations tab + `wallet_revokeExecutionPermission`).
 * `body` supports `{domain}`, `{chainName}`.
 */
export interface IStyleCopyCancelDelegation {
  title: string;
  body: string;
  hostLabel: string;
  chainLabel: string;
  rejectLabel: string;
  confirmLabel: string;
}

/** Title + body mapped to Signing Layer ceremony Confirm UI (`explanationHeader` / `explanationText`). Relayer Branding-native WebAuthn still uses the same keys via `PasskeyPromptModal`. */
export interface IStyleCopyPasskeyPromptEntry {
  title: string;
  body: string;
}

/**
 * Passkey ceremony copy. Signing Layer PRF paths receive these as
 * `CeremonyUiParams`; Relayer assertion uses the Branding overlay.
 * Keys align with {@link EPasskeyPromptReason}.
 */
export interface IStyleCopyPasskeyPrompt {
  unlock: IStyleCopyPasskeyPromptEntry;
  create: IStyleCopyPasskeyPromptEntry;
  sign: IStyleCopyPasskeyPromptEntry;
  encrypt: IStyleCopyPasskeyPromptEntry;
  decrypt: IStyleCopyPasskeyPromptEntry;
  relayerAuth: IStyleCopyPasskeyPromptEntry;
  walletUpgrade: IStyleCopyPasskeyPromptEntry;
  approveTransaction: IStyleCopyPasskeyPromptEntry;
  adjustFee: IStyleCopyPasskeyPromptEntry;
  backup: IStyleCopyPasskeyPromptEntry;
  exportPrivateKey: IStyleCopyPasskeyPromptEntry;
}

/**
 * OID4VCI credential-offer approval modal.
 * `body` supports `{issuerName}` and `{issuerId}`.
 */
export interface IStyleCopyCredentialOffer {
  title: string;
  body: string;
  offeredHeading: string;
  passkeyNote: string;
  rejectLabel: string;
  acceptLabel: string;
}

/**
 * OID4VP presentation approval modal.
 * `body` supports `{verifierName}` / `{verifierId}`;
 * `credentialDetail` supports `{credentialType}` / `{credentialIssuer}`.
 */
export interface IStyleCopyCredentialPresentation {
  title: string;
  body: string;
  credentialDetail: string;
  claimsHeading: string;
  passkeyNote: string;
  rejectLabel: string;
  shareLabel: string;
}

/**
 * Credentials tab + detail dialog.
 * `countLabel` supports `{count}`.
 */
export interface IStyleCopyCredentials {
  tabLabel: string;
  emptyCountLabel: string;
  countLabel: string;
  refreshLabel: string;
  loadingBody: string;
  emptyBody: string;
  loadFailedError: string;
  refreshFailedError: string;
  notFoundError: string;
  openFailedError: string;
  typeColumn: string;
  issuerColumn: string;
  issuedColumn: string;
  viewLabel: string;
  detailFallbackTitle: string;
  detailDescription: string;
  issuerLabel: string;
  formatLabel: string;
  issuedLabel: string;
  validUntilLabel: string;
  idLabel: string;
  claimsHeading: string;
  claimsLoading: string;
  claimsEmpty: string;
  closeLabel: string;
}

/**
 * Delegations tab (ERC-7715 grants grouped by host).
 * `countLabel` supports `{count}`.
 * `periodSummary` supports `{amount}`, `{symbol}`, `{duration}`.
 * `permissionSummary` supports `{permissionType}`, `{to}`.
 */
export interface IStyleCopyDelegations {
  tabLabel: string;
  emptyCountLabel: string;
  countLabel: string;
  refreshLabel: string;
  loadingBody: string;
  emptyBody: string;
  loadFailedError: string;
  refreshFailedError: string;
  cancelFailedError: string;
  notFoundError: string;
  cancelLabel: string;
  noMemoLabel: string;
  periodSummary: string;
  permissionSummary: string;
}

/**
 * Balances tab + add-asset flows.
 * `countLabel` supports `{count}`.
 * `addConfirmBody` is shown above the asset identity block.
 */
export interface IStyleCopyBalances {
  tabLabel: string;
  emptyCountLabel: string;
  countLabel: string;
  addLabel: string;
  refreshLabel: string;
  loadingBody: string;
  emptyBody: string;
  loadFailedError: string;
  refreshFailedError: string;
  addFailedError: string;
  invalidAddressError: string;
  assetColumn: string;
  chainColumn: string;
  balanceColumn: string;
  viewLabel: string;
  closeLabel: string;
  addDialogTitle: string;
  addDialogBody: string;
  addressLabel: string;
  addressPlaceholder: string;
  addDialogCancelLabel: string;
  addDialogSubmitLabel: string;
  addConfirmTitle: string;
  addConfirmBody: string;
  addConfirmWarning: string;
  addConfirmRejectLabel: string;
  addConfirmAcceptLabel: string;
  balanceUnavailable: string;
  balanceNonErc20: string;
  receiveLabel: string;
  receiveTitle: string;
  /** Supports `{chainLabel}`. */
  receiveBody: string;
  receiveAddressLabel: string;
  /** Supports `{chainLabel}`. */
  receiveQrAlt: string;
  receiveCopyLabel: string;
  receiveCopiedLabel: string;
  receiveCopyFailedLabel: string;
  receiveCloseLabel: string;
  sendLabel: string;
}

/**
 * Export private key warning modal (before Signing Layer reveal).
 */
export interface IStyleCopyExportPrivateKey {
  title: string;
  body: string;
  continueLabel: string;
  cancelLabel: string;
  closeLabel: string;
  revealingBody: string;
  cancelledError: string;
  failedError: string;
}

/**
 * Import private key warning modal (before Signing Layer paste UI).
 */
export interface IStyleCopyImportPrivateKey {
  title: string;
  body: string;
  continueLabel: string;
  cancelLabel: string;
  closeLabel: string;
  importingBody: string;
  cancelledError: string;
  invalidKeyError: string;
  failedError: string;
}

/**
 * Advanced options chooser (export / import / change account).
 */
export interface IStyleCopyAdvancedOptions {
  title: string;
  menuLabel: string;
  onboardingLabel: string;
  body: string;
  exportLabel: string;
  importLabel: string;
  changeAccountLabel: string;
  closeLabel: string;
}

/**
 * Account shell chips + select-network modal on the default MainPanel.
 */
export interface IStyleCopyAccount {
  selectNetworkTitle: string;
  selectNetworkCancelLabel: string;
  copyAddressLabel: string;
  addressCopiedLabel: string;
  addressCopyFailedLabel: string;
}

export interface IStyleCopyOptions {
  /** Product / wallet title shown in chrome and onboarding */
  productName?: string;
  /** Short supporting line under the product name */
  tagline?: string;
  /** Optional brand logo URL on the login screen (falls back to bundled 1Shot icon) */
  logoUrl?: string;
  /** Partial patch for account chips + select-network modal */
  account?: Partial<IStyleCopyAccount>;
  /** Partial patch for the connect modal */
  connect?: Partial<IStyleCopyConnect>;
  /** Partial patch for the wallet setup modal */
  walletSetup?: Partial<IStyleCopyWalletSetup>;
  /** Partial patch for the passkey name modal */
  passkeyName?: Partial<IStyleCopyPasskeyName>;
  /** Partial patch for the personal_sign modal */
  personalSign?: Partial<IStyleCopyPersonalSign>;
  /** Partial patch for the SIWE (EIP-4361) consent modal */
  siwe?: Partial<IStyleCopySiwe>;
  /** Partial patch for the EIP-712 typed-data modal */
  typedData?: Partial<IStyleCopyTypedData>;
  /** Partial patch for the eth_sendTransaction modal */
  sendTransaction?: Partial<IStyleCopySendTransaction>;
  /** Partial patch for the friendly ERC-20 transfer confirm */
  confirmTransfer?: Partial<IStyleCopyConfirmTransfer>;
  /** Partial patch for the in-wallet transfer tokens modal */
  transferTokens?: Partial<IStyleCopyTransferTokens>;
  /** Partial patch for EIP-7715 grant consent */
  grantExecutionPermission?: Partial<IStyleCopyGrantExecutionPermission>;
  /** Partial patch for delegation cancel / revoke confirm */
  cancelDelegation?: Partial<IStyleCopyCancelDelegation>;
  /** Partial patch for passkey ceremony Confirm copy (Signing) / Relayer overlay */
  passkeyPrompt?: {
    unlock?: Partial<IStyleCopyPasskeyPromptEntry>;
    create?: Partial<IStyleCopyPasskeyPromptEntry>;
    sign?: Partial<IStyleCopyPasskeyPromptEntry>;
    encrypt?: Partial<IStyleCopyPasskeyPromptEntry>;
    decrypt?: Partial<IStyleCopyPasskeyPromptEntry>;
    relayerAuth?: Partial<IStyleCopyPasskeyPromptEntry>;
    walletUpgrade?: Partial<IStyleCopyPasskeyPromptEntry>;
    approveTransaction?: Partial<IStyleCopyPasskeyPromptEntry>;
    adjustFee?: Partial<IStyleCopyPasskeyPromptEntry>;
    backup?: Partial<IStyleCopyPasskeyPromptEntry>;
    exportPrivateKey?: Partial<IStyleCopyPasskeyPromptEntry>;
  };
  /** Partial patch for the credential offer modal */
  credentialOffer?: Partial<IStyleCopyCredentialOffer>;
  /** Partial patch for the credential presentation modal */
  credentialPresentation?: Partial<IStyleCopyCredentialPresentation>;
  /** Partial patch for the credentials tab + detail dialog */
  credentials?: Partial<IStyleCopyCredentials>;
  /** Partial patch for the delegations tab */
  delegations?: Partial<IStyleCopyDelegations>;
  /** Partial patch for the balances tab + add-asset flows */
  balances?: Partial<IStyleCopyBalances>;
  /** Partial patch for the export-private-key modal */
  exportPrivateKey?: Partial<IStyleCopyExportPrivateKey>;
  /** Partial patch for the import-private-key modal */
  importPrivateKey?: Partial<IStyleCopyImportPrivateKey>;
  /** Partial patch for the advanced-options chooser */
  advancedOptions?: Partial<IStyleCopyAdvancedOptions>;
}

/** Fully resolved copy map after merging defaults + configure. */
export interface IResolvedCopy {
  productName: string;
  tagline: string;
  logoUrl: string;
  account: IStyleCopyAccount;
  connect: IStyleCopyConnect;
  walletSetup: IStyleCopyWalletSetup;
  passkeyName: IStyleCopyPasskeyName;
  personalSign: IStyleCopyPersonalSign;
  siwe: IStyleCopySiwe;
  typedData: IStyleCopyTypedData;
  sendTransaction: IStyleCopySendTransaction;
  confirmTransfer: IStyleCopyConfirmTransfer;
  transferTokens: IStyleCopyTransferTokens;
  grantExecutionPermission: IStyleCopyGrantExecutionPermission;
  cancelDelegation: IStyleCopyCancelDelegation;
  passkeyPrompt: IStyleCopyPasskeyPrompt;
  credentialOffer: IStyleCopyCredentialOffer;
  credentialPresentation: IStyleCopyCredentialPresentation;
  credentials: IStyleCopyCredentials;
  delegations: IStyleCopyDelegations;
  balances: IStyleCopyBalances;
  exportPrivateKey: IStyleCopyExportPrivateKey;
  importPrivateKey: IStyleCopyImportPrivateKey;
  advancedOptions: IStyleCopyAdvancedOptions;
}

export interface IStyleFeaturesOptions {
  /**
   * When true, hide the wallet chrome Close (X) control.
   * Useful for Inline hosts (extension side panel) where hide is a no-op.
   */
  hideCloseBox?: boolean;
  /** When true, hide the Credentials tab (host-driven credential flows still work). */
  disableCredentials?: boolean;
  /** When true, hide the Delegations tab (host-driven delegation flows still work). */
  disableDelegations?: boolean;
  /**
   * Hex EVM chain ids the Network dropdown may show.
   * Omit or empty ⇒ all catalog-enabled chains.
   */
  allowedChains?: string[];
}

export interface IResolvedStyleFeatures {
  hideCloseBox: boolean;
  disableCredentials: boolean;
  disableDelegations: boolean;
  /** `null` means no host allowlist (all enabled catalog chains). */
  allowedChains: string[] | null;
}

export interface IStyleOptions {
  theme?: IStyleThemeOptions;
  copy?: IStyleCopyOptions;
  /** When true, add `.dark` on <html>; when false, remove it; omit = unchanged */
  dark?: boolean;
  features?: IStyleFeaturesOptions;
  /**
   * Optional URL to receive transaction status update webhooks from the
   * 1Shot Relayer (https://1shotapi.com/docs/relayer/get-started/overview).
   * Pass `null` or `""` to clear.
   */
  destinationUrl?: string | null;
}

/** Fully resolved style after merging defaults + configure patches. */
export interface IResolvedStyle {
  theme: Required<IStyleThemeOptions>;
  copy: IResolvedCopy;
  dark: boolean;
  features: IResolvedStyleFeatures;
  /** Status webhook URL for the 1Shot Relayer; `null` when unset. */
  destinationUrl: string | null;
}
