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

/** In-wallet credential inventory modal. */
export interface IStyleCopyCredentialList {
  title: string;
  emptyBody: string;
  issuerLabel: string;
  issuedLabel: string;
  validUntilLabel: string;
  closeLabel: string;
}

export interface IStyleCopyOptions {
  /** Product / wallet title shown in chrome and onboarding */
  productName?: string;
  /** Short supporting line under the product name */
  tagline?: string;
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
  /** Partial patch for the credential offer modal */
  credentialOffer?: Partial<IStyleCopyCredentialOffer>;
  /** Partial patch for the credential presentation modal */
  credentialPresentation?: Partial<IStyleCopyCredentialPresentation>;
  /** Partial patch for the credential list modal */
  credentialList?: Partial<IStyleCopyCredentialList>;
}

/** Fully resolved copy map after merging defaults + setStyle. */
export interface IResolvedCopy {
  productName: string;
  tagline: string;
  connect: IStyleCopyConnect;
  walletSetup: IStyleCopyWalletSetup;
  passkeyName: IStyleCopyPasskeyName;
  personalSign: IStyleCopyPersonalSign;
  typedData: IStyleCopyTypedData;
  credentialOffer: IStyleCopyCredentialOffer;
  credentialPresentation: IStyleCopyCredentialPresentation;
  credentialList: IStyleCopyCredentialList;
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
