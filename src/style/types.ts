/**
 * Host-facing style knobs for `proxy.rpc("setStyle", options)`.
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
}

/** Name passkey modal (create-account flow). */
export interface IStyleCopyPasskeyName {
  title: string;
  body: string;
  fieldLabel: string;
  placeholder: string;
  emptyError: string;
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
 * `body` supports `{domain}`, `{amount}`, `{tokenName}`, `{tokenSymbol}`,
 * `{receiver}`, `{chainName}`.
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

/** Title + body for one passkey-ceremony explanation overlay. */
export interface IStyleCopyPasskeyPromptEntry {
  title: string;
  body: string;
}

/**
 * Non-interactive overlays shown while a WebAuthn ceremony is in flight.
 * Keys align with {@link EPasskeyPromptReason}.
 */
export interface IStyleCopyPasskeyPrompt {
  unlock: IStyleCopyPasskeyPromptEntry;
  create: IStyleCopyPasskeyPromptEntry;
  sign: IStyleCopyPasskeyPromptEntry;
  encrypt: IStyleCopyPasskeyPromptEntry;
  decrypt: IStyleCopyPasskeyPromptEntry;
  relayerAuth: IStyleCopyPasskeyPromptEntry;
  backup: IStyleCopyPasskeyPromptEntry;
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
 * Balances tab + add-asset flows.
 * `countLabel` supports `{count}`.
 * `addConfirmBody` supports `{assetName}` and `{chainLabel}`.
 */
export interface IStyleCopyBalances {
  tabLabel: string;
  emptyCountLabel: string;
  countLabel: string;
  addLabel: string;
  loadingBody: string;
  emptyBody: string;
  loadFailedError: string;
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
 * Create encrypted recovery backup modal.
 * `body` / `passphrasePrompt` support `{minLength}`.
 * `passphrasePrompt` + `continueLabel` are forwarded into the Signing Layer overlay.
 */
export interface IStyleCopyCreateBackup {
  title: string;
  body: string;
  passphrasePrompt: string;
  continueLabel: string;
  cancelLabel: string;
  closeLabel: string;
  copyLabel: string;
  copiedLabel: string;
  copyFailedLabel: string;
  doneLabel: string;
  encryptedLabel: string;
  passwordTooShortError: string;
  cancelledError: string;
  failedError: string;
}

/**
 * Restore from encrypted backup modal.
 * `passphraseLabel` + `restoreLabel` are forwarded into the Signing Layer overlay.
 */
export interface IStyleCopyRestoreBackup {
  title: string;
  body: string;
  passphraseLabel: string;
  restoreLabel: string;
  cancelLabel: string;
  closeLabel: string;
  doneLabel: string;
  successBody: string;
  decryptFailedError: string;
  cancelledError: string;
  failedError: string;
}

export interface IStyleCopyOptions {
  /** Product / wallet title shown in chrome and onboarding */
  productName?: string;
  /** Short supporting line under the product name */
  tagline?: string;
  /** Optional brand logo URL on the login screen (falls back to bundled 1Shot icon) */
  logoUrl?: string;
  /** Partial patch for the connect modal */
  connect?: Partial<IStyleCopyConnect>;
  /** Partial patch for the wallet setup modal */
  walletSetup?: Partial<IStyleCopyWalletSetup>;
  /** Partial patch for the passkey name modal */
  passkeyName?: Partial<IStyleCopyPasskeyName>;
  /** Partial patch for the personal_sign modal */
  personalSign?: Partial<IStyleCopyPersonalSign>;
  /** Partial patch for the EIP-712 typed-data modal */
  typedData?: Partial<IStyleCopyTypedData>;
  /** Partial patch for the eth_sendTransaction modal */
  sendTransaction?: Partial<IStyleCopySendTransaction>;
  /** Partial patch for the friendly ERC-20 transfer confirm */
  confirmTransfer?: Partial<IStyleCopyConfirmTransfer>;
  /** Partial patch for the in-wallet transfer tokens modal */
  transferTokens?: Partial<IStyleCopyTransferTokens>;
  /** Partial patch for passkey-ceremony explanation overlays */
  passkeyPrompt?: {
    unlock?: Partial<IStyleCopyPasskeyPromptEntry>;
    create?: Partial<IStyleCopyPasskeyPromptEntry>;
    sign?: Partial<IStyleCopyPasskeyPromptEntry>;
    encrypt?: Partial<IStyleCopyPasskeyPromptEntry>;
    decrypt?: Partial<IStyleCopyPasskeyPromptEntry>;
    relayerAuth?: Partial<IStyleCopyPasskeyPromptEntry>;
    backup?: Partial<IStyleCopyPasskeyPromptEntry>;
  };
  /** Partial patch for the credential offer modal */
  credentialOffer?: Partial<IStyleCopyCredentialOffer>;
  /** Partial patch for the credential presentation modal */
  credentialPresentation?: Partial<IStyleCopyCredentialPresentation>;
  /** Partial patch for the credentials tab + detail dialog */
  credentials?: Partial<IStyleCopyCredentials>;
  /** Partial patch for the balances tab + add-asset flows */
  balances?: Partial<IStyleCopyBalances>;
  /** Partial patch for the create-backup modal */
  createBackup?: Partial<IStyleCopyCreateBackup>;
  /** Partial patch for the restore-backup modal */
  restoreBackup?: Partial<IStyleCopyRestoreBackup>;
}

/** Fully resolved copy map after merging defaults + setStyle. */
export interface IResolvedCopy {
  productName: string;
  tagline: string;
  logoUrl: string;
  connect: IStyleCopyConnect;
  walletSetup: IStyleCopyWalletSetup;
  passkeyName: IStyleCopyPasskeyName;
  personalSign: IStyleCopyPersonalSign;
  typedData: IStyleCopyTypedData;
  sendTransaction: IStyleCopySendTransaction;
  confirmTransfer: IStyleCopyConfirmTransfer;
  transferTokens: IStyleCopyTransferTokens;
  passkeyPrompt: IStyleCopyPasskeyPrompt;
  credentialOffer: IStyleCopyCredentialOffer;
  credentialPresentation: IStyleCopyCredentialPresentation;
  credentials: IStyleCopyCredentials;
  balances: IStyleCopyBalances;
  createBackup: IStyleCopyCreateBackup;
  restoreBackup: IStyleCopyRestoreBackup;
}

export interface IStyleOptions {
  theme?: IStyleThemeOptions;
  copy?: IStyleCopyOptions;
  /** When true, add `.dark` on <html>; when false, remove it; omit = unchanged */
  dark?: boolean;
}

/** Fully resolved style after merging defaults + setStyle patches. */
export interface IResolvedStyle {
  theme: Required<IStyleThemeOptions>;
  copy: IResolvedCopy;
  dark: boolean;
}
