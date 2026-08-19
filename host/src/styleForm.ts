/** Flat form state for the host style playground. */
export interface IStyleFormState {
  // Basic
  logoUrl: string;
  productName: string;
  tagline: string;

  // Style (colors + chrome)
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  accent: string;
  accentForeground: string;
  radius: string;
  fontSans: string;
  dark: boolean;
  /**
   * Hex chain ids to pass as `features.allowedChains`.
   * Empty ⇒ omit (all catalog-enabled chains).
   */
  allowedChainIds: string[];
  /** Pass as `features.hideCloseBox` (Inline hosts). */
  hideCloseBox: boolean;
  /** Pass as `features.disableCredentials`. */
  disableCredentials: boolean;
  /** Pass as `features.disableDelegations`. */
  disableDelegations: boolean;

  // Text — Connect
  connectTitle: string;
  connectBody: string;
  connectContinue: string;
  connectReject: string;

  // Text — Wallet setup
  setupTitle: string;
  setupBody: string;
  setupCreate: string;
  setupLogin: string;
  setupCancel: string;
  setupPasskeyTimeoutError: string;
  setupPasskeyFailedError: string;

  // Text — Account shell (network + address chips)
  selectNetworkTitle: string;
  selectNetworkCancelLabel: string;
  copyAddressLabel: string;
  addressCopiedLabel: string;
  addressCopyFailedLabel: string;

  // Text — Passkey name
  passkeyTitle: string;
  passkeyBody: string;
  passkeyContinue: string;
  passkeyCancel: string;
  passkeyTermsPrefix: string;
  passkeyTermsOfServiceLabel: string;
  passkeyTermsJoiner: string;
  passkeyPrivacyLabel: string;
  passkeyTermsError: string;

  // Text — Personal sign
  signTitle: string;
  signLabel: string;
  signReject: string;

  // Text — Typed data
  typedTitle: string;
  typedSignLabel: string;
  typedReject: string;

  // Text — SIWE (EIP-4361)
  siweTitle: string;
  siweBody: string;
  siweEstimatedChangesLabel: string;
  siweNoChangesLabel: string;
  siweNetworkLabel: string;
  siweRequestFromLabel: string;
  siweSigningInWithLabel: string;
  siweMessageLabel: string;
  siweUriLabel: string;
  siweRejectLabel: string;
  siweSignLabel: string;
  siweSigningHint: string;

  // Text — Send transaction
  txTitle: string;
  txSignLabel: string;
  txReject: string;

  // Text — Credential offer
  credOfferTitle: string;
  credOfferBody: string;
  credOfferAccept: string;
  credOfferReject: string;

  // Text — Credential presentation
  credPresentTitle: string;
  credPresentBody: string;
  credPresentShare: string;
  credPresentReject: string;

  // Text — Credentials tab
  credTabLabel: string;
  credEmptyCount: string;
  credCountLabel: string;
  credEmptyBody: string;
  credRefresh: string;
  credView: string;
  credDetailDescription: string;
  credClaimsHeading: string;
  credClose: string;

  // Text — Delegations tab
  delTabLabel: string;
  delEmptyCount: string;
  delCountLabel: string;
  delEmptyBody: string;
  delRefresh: string;
  delCancel: string;
  delNoMemo: string;

  // Text — Balances / Receive
  balTabLabel: string;
  balRefresh: string;
  receiveLabel: string;
  receiveTitle: string;
  receiveBody: string;
  receiveAddressLabel: string;
  receiveQrAlt: string;
  receiveCopyLabel: string;
  receiveCopiedLabel: string;
  receiveCopyFailedLabel: string;
  receiveCloseLabel: string;
  sendLabel: string;

  // Text — Confirm transfer (host ERC-20)
  confirmTransferTitle: string;
  confirmTransferBody: string;
  confirmTransferConfirm: string;
  confirmTransferReject: string;

  // Text — Transfer tokens (in-wallet send)
  transferTokensTitle: string;
  transferTokensSend: string;
  transferTokensCancel: string;
  transferTokensSentTitle: string;
  transferTokensViewExplorer: string;
  transferTokensDone: string;

  // Text — EIP-7715 grant / cancel
  grantPermissionTitle: string;
  grantPermissionGrant: string;
  grantPermissionReject: string;
  cancelDelegationTitle: string;
  cancelDelegationConfirm: string;
  cancelDelegationReject: string;

  // Text — Passkey ceremony overlays
  passkeyPromptUnlockTitle: string;
  passkeyPromptCreateTitle: string;
  passkeyPromptSignTitle: string;
  passkeyPromptEncryptTitle: string;
  passkeyPromptDecryptTitle: string;
  passkeyPromptRelayerTitle: string;
  passkeyPromptBackupTitle: string;
  passkeyPromptExportPrivateKeyTitle: string;

  // Text — Export private key
  exportPrivateKeyTitle: string;
  exportPrivateKeyBody: string;
  exportPrivateKeyContinue: string;
  exportPrivateKeyCancel: string;

  // Text — Import private key
  importPrivateKeyTitle: string;
  importPrivateKeyBody: string;
  importPrivateKeyContinue: string;
  importPrivateKeyCancel: string;

  // Text — Advanced options
  advancedOptionsTitle: string;
  advancedOptionsMenuLabel: string;
  advancedOptionsBody: string;
  advancedOptionsChangeAccountLabel: string;
}

/** Catalog options for the Allowed chains configurator (matches HardcodedChainRepository). */
export const CATALOG_CHAIN_OPTIONS: ReadonlyArray<{
  chainId: string;
  label: string;
}> = [
  { chainId: "0x4cef52", label: "Arc Testnet" },
  { chainId: "0xaa36a7", label: "Sepolia" },
  { chainId: "0x14a34", label: "Base Sepolia" },
  { chainId: "0x1", label: "Ethereum" },
  { chainId: "0xe708", label: "Linea" },
  { chainId: "0xa4b1", label: "Arbitrum" },
  { chainId: "0xa", label: "Optimism" },
  { chainId: "0x38", label: "BSC" },
  { chainId: "0x2105", label: "Base" },
  { chainId: "0x89", label: "Polygon" },
  { chainId: "0x92", label: "Sonic" },
  { chainId: "0x82", label: "Unichain" },
  { chainId: "0x8f", label: "Monad" },
  { chainId: "0xa4ec", label: "Celo" },
  { chainId: "0x1237", label: "Robinhood" },
];

export const ACME_PRESET: IStyleFormState = {
  logoUrl: "",
  productName: "Acme Wallet",
  tagline: "Powered by 1Shot",
  primary: "#3b6ef5",
  primaryForeground: "#ffffff",
  background: "#ffffff",
  foreground: "#171717",
  muted: "#f5f5f5",
  mutedForeground: "#737373",
  border: "#e5e5e5",
  accent: "#eff6ff",
  accentForeground: "#1e3a8a",
  radius: "0.625rem",
  fontSans: "",
  dark: false,
  allowedChainIds: [],
  hideCloseBox: false,
  disableCredentials: false,
  disableDelegations: false,
  connectTitle: "Connect to Acme",
  connectBody: "Acme is requesting your wallet address.",
  connectContinue: "Allow",
  connectReject: "Reject",
  setupTitle: "Welcome to Acme",
  setupBody: "Create or restore your Acme passkey wallet.",
  setupCreate: "Get started",
  setupLogin: "Log in",
  setupCancel: "Cancel",
  setupPasskeyTimeoutError:
    "Passkey confirmation timed out. Please try again.",
  setupPasskeyFailedError:
    "Could not complete passkey authentication. Please try again.",
  selectNetworkTitle: "Select network",
  selectNetworkCancelLabel: "Cancel",
  copyAddressLabel: "Copy address",
  addressCopiedLabel: "Address copied",
  addressCopyFailedLabel: "Copy failed",
  passkeyTitle: "Name this passkey",
  passkeyBody: "Choose a name for this wallet passkey.",
  passkeyContinue: "Save name",
  passkeyCancel: "Cancel",
  passkeyTermsPrefix: "I agree to the",
  passkeyTermsOfServiceLabel: "Terms of Service",
  passkeyTermsJoiner: "and",
  passkeyPrivacyLabel: "Privacy Policy",
  passkeyTermsError:
    "Accept the Terms of Service and Privacy Policy to continue.",
  signTitle: "Approve signature",
  signLabel: "Sign",
  signReject: "Reject",
  typedTitle: "Approve typed data",
  typedSignLabel: "Sign",
  typedReject: "Reject",
  siweTitle: "Sign-in request",
  siweBody:
    "A site wants you to sign in by proving you own this account. This will not spend tokens or change on-chain balances.",
  siweEstimatedChangesLabel: "Estimated changes",
  siweNoChangesLabel: "No changes",
  siweNetworkLabel: "Network",
  siweRequestFromLabel: "Request from",
  siweSigningInWithLabel: "Signing in with",
  siweMessageLabel: "Message",
  siweUriLabel: "URI",
  siweRejectLabel: "Cancel",
  siweSignLabel: "Confirm",
  siweSigningHint: "Confirm in the signing panel…",
  txTitle: "Approve transaction",
  txSignLabel: "Sign",
  txReject: "Reject",
  credOfferTitle: "Accept this credential?",
  credOfferBody: "Review the offer before accepting.",
  credOfferAccept: "Accept",
  credOfferReject: "Reject",
  credPresentTitle: "Share this credential?",
  credPresentBody: "A verifier is requesting a presentation.",
  credPresentShare: "Share",
  credPresentReject: "Reject",
  credTabLabel: "Credentials",
  credEmptyCount: "No credentials stored yet.",
  credCountLabel: "{count} credential(s)",
  credEmptyBody:
    "Accept an offer or refresh from the relayer to sync credentials.",
  credRefresh: "Refresh",
  credView: "View",
  credDetailDescription: "Full credential details and claims.",
  credClaimsHeading: "Claims",
  credClose: "Close",
  delTabLabel: "Delegations",
  delEmptyCount: "No spending permissions yet.",
  delCountLabel: "{count} permission(s)",
  delEmptyBody:
    "Permissions granted to apps appear here. Refresh to sync from the vault.",
  delRefresh: "Refresh",
  delCancel: "Cancel",
  delNoMemo: "No memo",
  balTabLabel: "Balances",
  balRefresh: "Refresh",
  receiveLabel: "Receive",
  receiveTitle: "Receive",
  receiveBody: "Scan this QR code or copy your {chainLabel} address.",
  receiveAddressLabel: "Address",
  receiveQrAlt: "{chainLabel} wallet address",
  receiveCopyLabel: "Copy address",
  receiveCopiedLabel: "Address copied",
  receiveCopyFailedLabel: "Copy failed",
  receiveCloseLabel: "Close",
  sendLabel: "Send",
  confirmTransferTitle: "Confirm Transfer",
  confirmTransferBody:
    "{domain} is requesting to send tokens from your wallet. Review the amount and recipient before confirming.",
  confirmTransferConfirm: "Confirm",
  confirmTransferReject: "Reject",
  transferTokensTitle: "Send",
  transferTokensSend: "Send",
  transferTokensCancel: "Cancel",
  transferTokensSentTitle: "Transaction sent",
  transferTokensViewExplorer: "View on explorer",
  transferTokensDone: "Done",
  grantPermissionTitle: "Grant spending permission",
  grantPermissionGrant: "Grant",
  grantPermissionReject: "Reject",
  cancelDelegationTitle: "Cancel permission",
  cancelDelegationConfirm: "Cancel permission",
  cancelDelegationReject: "Keep",
  passkeyPromptUnlockTitle: "Unlock with passkey",
  passkeyPromptCreateTitle: "Create passkey",
  passkeyPromptSignTitle: "Confirm with passkey",
  passkeyPromptEncryptTitle: "Encrypt with passkey",
  passkeyPromptDecryptTitle: "Decrypt with passkey",
  passkeyPromptRelayerTitle: "Authenticate with passkey",
  passkeyPromptBackupTitle: "Confirm backup",
  passkeyPromptExportPrivateKeyTitle: "Export private key",
  exportPrivateKeyTitle: "Export private key",
  exportPrivateKeyBody:
    "Anyone with this private key can control your wallet. Store it safely.",
  exportPrivateKeyContinue: "Export key",
  exportPrivateKeyCancel: "Cancel",
  importPrivateKeyTitle: "Import private key",
  importPrivateKeyBody: "Paste a private key to unlock this tab only.",
  importPrivateKeyContinue: "Import key",
  importPrivateKeyCancel: "Cancel",
  advancedOptionsTitle: "Advanced options",
  advancedOptionsMenuLabel: "Advanced options",
  advancedOptionsBody:
    "Import or export your private key, or switch to a different passkey account.",
  advancedOptionsChangeAccountLabel: "Change account",
};

export const OCEAN_PRESET: IStyleFormState = {
  ...ACME_PRESET,
  productName: "Ocean Wallet",
  tagline: "Host setStyle preset",
  primary: "#0e7490",
  primaryForeground: "#ffffff",
  background: "#f0f9ff",
  foreground: "#164e63",
  muted: "#e0f2fe",
  mutedForeground: "#0e7490",
  border: "#bae6fd",
  accent: "#cffafe",
  accentForeground: "#155e75",
  radius: "0.75rem",
  connectTitle: "Connect to Ocean",
  setupTitle: "Welcome aboard",
  setupCreate: "Create Ocean account",
  passkeyTitle: "Name your Ocean passkey",
  signTitle: "Sign with Ocean",
  signLabel: "Approve",
  typedTitle: "Ocean typed data",
  txTitle: "Ocean transaction",
  credOfferTitle: "Accept Ocean credential?",
  credPresentTitle: "Share with verifier?",
  balTabLabel: "Balances",
  receiveTitle: "Receive to Ocean",
  receiveBody: "Scan or copy your {chainLabel} Ocean address.",
  exportPrivateKeyTitle: "Export Ocean private key",
  importPrivateKeyTitle: "Import Ocean private key",
};

export const DEFAULTS_PRESET: IStyleFormState = {
  ...ACME_PRESET,
  productName: "1Shot Wallet",
  tagline: "Passkey-secured embedded wallet",
  primary: "#171717",
  primaryForeground: "#fafafa",
  background: "#ffffff",
  foreground: "#171717",
  muted: "#f5f5f5",
  mutedForeground: "#737373",
  border: "#e5e5e5",
  accent: "#f5f5f5",
  accentForeground: "#171717",
  radius: "0.625rem",
  connectTitle: "Connect wallet",
  connectBody: "",
  connectContinue: "Continue",
  setupTitle: "Set up your wallet",
  setupBody: "",
  setupCreate: "Create account",
  passkeyTitle: "Name your passkey",
  passkeyBody: "",
  passkeyContinue: "Continue",
  passkeyTermsPrefix: "I agree to the",
  passkeyTermsOfServiceLabel: "Terms of Service",
  passkeyTermsJoiner: "and",
  passkeyPrivacyLabel: "Privacy Policy",
  passkeyTermsError:
    "Accept the Terms of Service and Privacy Policy to continue.",
  signTitle: "Sign message",
  signLabel: "Sign",
  typedTitle: "Sign typed data",
  typedSignLabel: "Sign",
  txTitle: "Send transaction",
  txSignLabel: "Sign",
  siweTitle: "Sign-in request",
  siweBody:
    "A site wants you to sign in by proving you own this account. This will not spend tokens or change on-chain balances.",
  siweEstimatedChangesLabel: "Estimated changes",
  siweNoChangesLabel: "No changes",
  siweNetworkLabel: "Network",
  siweRequestFromLabel: "Request from",
  siweSigningInWithLabel: "Signing in with",
  siweMessageLabel: "Message",
  siweUriLabel: "URI",
  siweRejectLabel: "Cancel",
  siweSignLabel: "Confirm",
  siweSigningHint: "Confirm in the signing panel…",
  credOfferTitle: "Accept credential offer?",
  credOfferBody: "",
  credPresentTitle: "Share credential?",
  credPresentBody: "",
  credTabLabel: "Credentials",
  credEmptyCount: "No credentials stored yet.",
  credCountLabel: "{count} credential(s)",
  credEmptyBody:
    "Accept an offer or refresh from the relayer to sync credentials.",
  credRefresh: "Refresh",
  credView: "View",
  credDetailDescription: "Full credential details and claims.",
  credClaimsHeading: "Claims",
  credClose: "Close",
  delTabLabel: "Delegations",
  delEmptyCount: "No spending permissions yet.",
  delCountLabel: "{count} permission(s)",
  delEmptyBody:
    "Permissions granted to apps appear here. Refresh to sync from the vault.",
  delRefresh: "Refresh",
  delCancel: "Cancel",
  delNoMemo: "No memo",
  balTabLabel: "Balances",
  balRefresh: "Refresh",
  receiveLabel: "Receive",
  receiveTitle: "Receive",
  receiveBody: "Scan this QR code or copy your {chainLabel} address.",
  receiveAddressLabel: "Address",
  receiveQrAlt: "{chainLabel} wallet address",
  receiveCopyLabel: "Copy address",
  receiveCopiedLabel: "Address copied",
  receiveCopyFailedLabel: "Copy failed",
  receiveCloseLabel: "Close",
  sendLabel: "Send",
  confirmTransferTitle: "Confirm transfer",
  confirmTransferBody:
    "{domain} is requesting to send tokens from your wallet. Review the amount and recipient before confirming.",
  confirmTransferConfirm: "Confirm",
  confirmTransferReject: "Reject",
  transferTokensTitle: "Send",
  transferTokensSend: "Send",
  transferTokensCancel: "Cancel",
  transferTokensSentTitle: "Transaction sent",
  transferTokensViewExplorer: "View on explorer",
  transferTokensDone: "Done",
  grantPermissionTitle: "Grant spending permission",
  grantPermissionGrant: "Grant",
  grantPermissionReject: "Reject",
  cancelDelegationTitle: "Cancel permission",
  cancelDelegationConfirm: "Cancel permission",
  cancelDelegationReject: "Keep",
  passkeyPromptUnlockTitle: "Unlock with passkey",
  passkeyPromptCreateTitle: "Create passkey",
  passkeyPromptSignTitle: "Confirm with passkey",
  passkeyPromptEncryptTitle: "Encrypt with passkey",
  passkeyPromptDecryptTitle: "Decrypt with passkey",
  passkeyPromptRelayerTitle: "Authenticate with passkey",
  passkeyPromptBackupTitle: "Confirm backup",
  passkeyPromptExportPrivateKeyTitle: "Export private key",
  exportPrivateKeyTitle: "Export private key",
  exportPrivateKeyBody: "",
  importPrivateKeyTitle: "Import private key",
  importPrivateKeyBody: "",
  advancedOptionsTitle: "Advanced options",
  advancedOptionsMenuLabel: "",
  advancedOptionsBody: "",
  advancedOptionsChangeAccountLabel: "",
};

function put(
  target: Record<string, string>,
  key: string,
  value: string,
): void {
  const trimmed = value.trim();
  if (trimmed) target[key] = trimmed;
}

/** Build a `setStyle` RPC payload from the flat form (omit empty theme/copy keys). */
export function buildSetStylePayload(
  form: IStyleFormState,
): Record<string, unknown> {
  const theme: Record<string, string> = {};
  put(theme, "primary", form.primary);
  put(theme, "primaryForeground", form.primaryForeground);
  put(theme, "background", form.background);
  put(theme, "foreground", form.foreground);
  put(theme, "muted", form.muted);
  put(theme, "mutedForeground", form.mutedForeground);
  put(theme, "border", form.border);
  put(theme, "accent", form.accent);
  put(theme, "accentForeground", form.accentForeground);
  put(theme, "radius", form.radius);
  put(theme, "fontSans", form.fontSans);

  const copy: Record<string, unknown> = {};
  put(copy as Record<string, string>, "productName", form.productName);
  put(copy as Record<string, string>, "tagline", form.tagline);
  put(copy as Record<string, string>, "logoUrl", form.logoUrl);

  const connect: Record<string, string> = {};
  put(connect, "title", form.connectTitle);
  put(connect, "body", form.connectBody);
  put(connect, "continueLabel", form.connectContinue);
  put(connect, "rejectLabel", form.connectReject);
  if (Object.keys(connect).length > 0) copy.connect = connect;

  const walletSetup: Record<string, string> = {};
  put(walletSetup, "title", form.setupTitle);
  put(walletSetup, "body", form.setupBody);
  put(walletSetup, "createLabel", form.setupCreate);
  put(walletSetup, "loginLabel", form.setupLogin);
  put(walletSetup, "cancelLabel", form.setupCancel);
  put(walletSetup, "passkeyTimeoutError", form.setupPasskeyTimeoutError);
  put(walletSetup, "passkeyFailedError", form.setupPasskeyFailedError);
  if (Object.keys(walletSetup).length > 0) copy.walletSetup = walletSetup;

  const account: Record<string, string> = {};
  put(account, "selectNetworkTitle", form.selectNetworkTitle);
  put(account, "selectNetworkCancelLabel", form.selectNetworkCancelLabel);
  put(account, "copyAddressLabel", form.copyAddressLabel);
  put(account, "addressCopiedLabel", form.addressCopiedLabel);
  put(account, "addressCopyFailedLabel", form.addressCopyFailedLabel);
  if (Object.keys(account).length > 0) copy.account = account;

  const passkeyName: Record<string, string> = {};
  put(passkeyName, "title", form.passkeyTitle);
  put(passkeyName, "body", form.passkeyBody);
  put(passkeyName, "continueLabel", form.passkeyContinue);
  put(passkeyName, "cancelLabel", form.passkeyCancel);
  put(passkeyName, "termsAcceptancePrefix", form.passkeyTermsPrefix);
  put(passkeyName, "termsOfServiceLabel", form.passkeyTermsOfServiceLabel);
  put(passkeyName, "termsAcceptanceJoiner", form.passkeyTermsJoiner);
  put(passkeyName, "privacyPolicyLabel", form.passkeyPrivacyLabel);
  put(passkeyName, "termsAcceptanceError", form.passkeyTermsError);
  if (Object.keys(passkeyName).length > 0) copy.passkeyName = passkeyName;

  const personalSign: Record<string, string> = {};
  put(personalSign, "title", form.signTitle);
  put(personalSign, "signLabel", form.signLabel);
  put(personalSign, "rejectLabel", form.signReject);
  if (Object.keys(personalSign).length > 0) copy.personalSign = personalSign;

  const typedData: Record<string, string> = {};
  put(typedData, "title", form.typedTitle);
  put(typedData, "signLabel", form.typedSignLabel);
  put(typedData, "rejectLabel", form.typedReject);
  if (Object.keys(typedData).length > 0) copy.typedData = typedData;

  const siwe: Record<string, string> = {};
  put(siwe, "title", form.siweTitle);
  put(siwe, "body", form.siweBody);
  put(siwe, "estimatedChangesLabel", form.siweEstimatedChangesLabel);
  put(siwe, "noChangesLabel", form.siweNoChangesLabel);
  put(siwe, "networkLabel", form.siweNetworkLabel);
  put(siwe, "requestFromLabel", form.siweRequestFromLabel);
  put(siwe, "signingInWithLabel", form.siweSigningInWithLabel);
  put(siwe, "messageLabel", form.siweMessageLabel);
  put(siwe, "uriLabel", form.siweUriLabel);
  put(siwe, "rejectLabel", form.siweRejectLabel);
  put(siwe, "signLabel", form.siweSignLabel);
  put(siwe, "signingHint", form.siweSigningHint);
  if (Object.keys(siwe).length > 0) copy.siwe = siwe;

  const sendTransaction: Record<string, string> = {};
  put(sendTransaction, "title", form.txTitle);
  put(sendTransaction, "signLabel", form.txSignLabel);
  put(sendTransaction, "rejectLabel", form.txReject);
  if (Object.keys(sendTransaction).length > 0) {
    copy.sendTransaction = sendTransaction;
  }

  const confirmTransfer: Record<string, string> = {};
  put(confirmTransfer, "title", form.confirmTransferTitle);
  put(confirmTransfer, "body", form.confirmTransferBody);
  put(confirmTransfer, "confirmLabel", form.confirmTransferConfirm);
  put(confirmTransfer, "rejectLabel", form.confirmTransferReject);
  if (Object.keys(confirmTransfer).length > 0) {
    copy.confirmTransfer = confirmTransfer;
  }

  const transferTokens: Record<string, string> = {};
  put(transferTokens, "title", form.transferTokensTitle);
  put(transferTokens, "sendLabel", form.transferTokensSend);
  put(transferTokens, "cancelLabel", form.transferTokensCancel);
  put(transferTokens, "sentTitle", form.transferTokensSentTitle);
  put(transferTokens, "viewOnExplorerLabel", form.transferTokensViewExplorer);
  put(transferTokens, "doneLabel", form.transferTokensDone);
  if (Object.keys(transferTokens).length > 0) {
    copy.transferTokens = transferTokens;
  }

  const grantExecutionPermission: Record<string, string> = {};
  put(grantExecutionPermission, "title", form.grantPermissionTitle);
  put(grantExecutionPermission, "grantLabel", form.grantPermissionGrant);
  put(grantExecutionPermission, "rejectLabel", form.grantPermissionReject);
  if (Object.keys(grantExecutionPermission).length > 0) {
    copy.grantExecutionPermission = grantExecutionPermission;
  }

  const cancelDelegation: Record<string, string> = {};
  put(cancelDelegation, "title", form.cancelDelegationTitle);
  put(cancelDelegation, "confirmLabel", form.cancelDelegationConfirm);
  put(cancelDelegation, "rejectLabel", form.cancelDelegationReject);
  if (Object.keys(cancelDelegation).length > 0) {
    copy.cancelDelegation = cancelDelegation;
  }

  const passkeyPrompt: Record<string, Record<string, string>> = {};
  const unlock: Record<string, string> = {};
  put(unlock, "title", form.passkeyPromptUnlockTitle);
  if (Object.keys(unlock).length > 0) {
    passkeyPrompt.unlock = unlock;
  }
  const create: Record<string, string> = {};
  put(create, "title", form.passkeyPromptCreateTitle);
  if (Object.keys(create).length > 0) {
    passkeyPrompt.create = create;
  }
  const sign: Record<string, string> = {};
  put(sign, "title", form.passkeyPromptSignTitle);
  if (Object.keys(sign).length > 0) {
    passkeyPrompt.sign = sign;
  }
  const encrypt: Record<string, string> = {};
  put(encrypt, "title", form.passkeyPromptEncryptTitle);
  if (Object.keys(encrypt).length > 0) {
    passkeyPrompt.encrypt = encrypt;
  }
  const decrypt: Record<string, string> = {};
  put(decrypt, "title", form.passkeyPromptDecryptTitle);
  if (Object.keys(decrypt).length > 0) {
    passkeyPrompt.decrypt = decrypt;
  }
  const relayerAuth: Record<string, string> = {};
  put(relayerAuth, "title", form.passkeyPromptRelayerTitle);
  if (Object.keys(relayerAuth).length > 0) {
    passkeyPrompt.relayerAuth = relayerAuth;
  }
  const backup: Record<string, string> = {};
  put(backup, "title", form.passkeyPromptBackupTitle);
  if (Object.keys(backup).length > 0) {
    passkeyPrompt.backup = backup;
  }
  const exportPrivateKeyPrompt: Record<string, string> = {};
  put(exportPrivateKeyPrompt, "title", form.passkeyPromptExportPrivateKeyTitle);
  if (Object.keys(exportPrivateKeyPrompt).length > 0) {
    passkeyPrompt.exportPrivateKey = exportPrivateKeyPrompt;
  }
  if (Object.keys(passkeyPrompt).length > 0) {
    copy.passkeyPrompt = passkeyPrompt;
  }

  const credentialOffer: Record<string, string> = {};
  put(credentialOffer, "title", form.credOfferTitle);
  put(credentialOffer, "body", form.credOfferBody);
  put(credentialOffer, "acceptLabel", form.credOfferAccept);
  put(credentialOffer, "rejectLabel", form.credOfferReject);
  if (Object.keys(credentialOffer).length > 0) {
    copy.credentialOffer = credentialOffer;
  }

  const credentialPresentation: Record<string, string> = {};
  put(credentialPresentation, "title", form.credPresentTitle);
  put(credentialPresentation, "body", form.credPresentBody);
  put(credentialPresentation, "shareLabel", form.credPresentShare);
  put(credentialPresentation, "rejectLabel", form.credPresentReject);
  if (Object.keys(credentialPresentation).length > 0) {
    copy.credentialPresentation = credentialPresentation;
  }

  const credentials: Record<string, string> = {};
  put(credentials, "tabLabel", form.credTabLabel);
  put(credentials, "emptyCountLabel", form.credEmptyCount);
  put(credentials, "countLabel", form.credCountLabel);
  put(credentials, "emptyBody", form.credEmptyBody);
  put(credentials, "refreshLabel", form.credRefresh);
  put(credentials, "viewLabel", form.credView);
  put(credentials, "detailDescription", form.credDetailDescription);
  put(credentials, "claimsHeading", form.credClaimsHeading);
  put(credentials, "closeLabel", form.credClose);
  if (Object.keys(credentials).length > 0) copy.credentials = credentials;

  const delegations: Record<string, string> = {};
  put(delegations, "tabLabel", form.delTabLabel);
  put(delegations, "emptyCountLabel", form.delEmptyCount);
  put(delegations, "countLabel", form.delCountLabel);
  put(delegations, "emptyBody", form.delEmptyBody);
  put(delegations, "refreshLabel", form.delRefresh);
  put(delegations, "cancelLabel", form.delCancel);
  put(delegations, "noMemoLabel", form.delNoMemo);
  if (Object.keys(delegations).length > 0) copy.delegations = delegations;

  const balances: Record<string, string> = {};
  put(balances, "tabLabel", form.balTabLabel);
  put(balances, "refreshLabel", form.balRefresh);
  put(balances, "receiveLabel", form.receiveLabel);
  put(balances, "receiveTitle", form.receiveTitle);
  put(balances, "receiveBody", form.receiveBody);
  put(balances, "receiveAddressLabel", form.receiveAddressLabel);
  put(balances, "receiveQrAlt", form.receiveQrAlt);
  put(balances, "receiveCopyLabel", form.receiveCopyLabel);
  put(balances, "receiveCopiedLabel", form.receiveCopiedLabel);
  put(balances, "receiveCopyFailedLabel", form.receiveCopyFailedLabel);
  put(balances, "receiveCloseLabel", form.receiveCloseLabel);
  put(balances, "sendLabel", form.sendLabel);
  if (Object.keys(balances).length > 0) copy.balances = balances;

  const exportPrivateKey: Record<string, string> = {};
  put(exportPrivateKey, "title", form.exportPrivateKeyTitle);
  put(exportPrivateKey, "body", form.exportPrivateKeyBody);
  put(exportPrivateKey, "continueLabel", form.exportPrivateKeyContinue);
  put(exportPrivateKey, "cancelLabel", form.exportPrivateKeyCancel);
  if (Object.keys(exportPrivateKey).length > 0) {
    copy.exportPrivateKey = exportPrivateKey;
  }

  const importPrivateKey: Record<string, string> = {};
  put(importPrivateKey, "title", form.importPrivateKeyTitle);
  put(importPrivateKey, "body", form.importPrivateKeyBody);
  put(importPrivateKey, "continueLabel", form.importPrivateKeyContinue);
  put(importPrivateKey, "cancelLabel", form.importPrivateKeyCancel);
  if (Object.keys(importPrivateKey).length > 0) {
    copy.importPrivateKey = importPrivateKey;
  }

  const advancedOptions: Record<string, string> = {};
  put(advancedOptions, "title", form.advancedOptionsTitle);
  put(advancedOptions, "menuLabel", form.advancedOptionsMenuLabel);
  put(advancedOptions, "body", form.advancedOptionsBody);
  put(
    advancedOptions,
    "changeAccountLabel",
    form.advancedOptionsChangeAccountLabel,
  );
  if (Object.keys(advancedOptions).length > 0) {
    copy.advancedOptions = advancedOptions;
  }

  const payload: Record<string, unknown> = { dark: form.dark };
  if (Object.keys(theme).length > 0) payload.theme = theme;
  if (Object.keys(copy).length > 0) payload.copy = copy;
  payload.features = {
    hideCloseBox: form.hideCloseBox,
    disableCredentials: form.disableCredentials,
    disableDelegations: form.disableDelegations,
    allowedChains: [...form.allowedChainIds],
  };
  return payload;
}
