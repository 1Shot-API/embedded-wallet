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

  // Text — Passkey name
  passkeyTitle: string;
  passkeyBody: string;
  passkeyContinue: string;
  passkeyCancel: string;

  // Text — Personal sign
  signTitle: string;
  signLabel: string;
  signReject: string;

  // Text — Typed data
  typedTitle: string;
  typedSignLabel: string;
  typedReject: string;

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

  // Text — Balances / Receive
  balTabLabel: string;
  receiveLabel: string;
  receiveTitle: string;
  receiveBody: string;
  receiveAddressLabel: string;
  receiveQrAlt: string;
  receiveCopyLabel: string;
  receiveCopiedLabel: string;
  receiveCopyFailedLabel: string;
  receiveCloseLabel: string;

  // Text — Create backup
  backupTitle: string;
  backupBody: string;
  backupContinue: string;
  backupCancel: string;

  // Text — Restore backup
  restoreTitle: string;
  restoreBody: string;
  restoreLabel: string;
  restoreCancel: string;
}

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
  connectTitle: "Connect to Acme",
  connectBody: "Acme is requesting your wallet address.",
  connectContinue: "Allow",
  connectReject: "Reject",
  setupTitle: "Welcome to Acme",
  setupBody: "Create or restore your Acme passkey wallet.",
  setupCreate: "Get started",
  setupLogin: "Log in",
  setupCancel: "Cancel",
  passkeyTitle: "Name this passkey",
  passkeyBody: "Choose a name for this wallet passkey.",
  passkeyContinue: "Save name",
  passkeyCancel: "Cancel",
  signTitle: "Approve signature",
  signLabel: "Sign",
  signReject: "Reject",
  typedTitle: "Approve typed data",
  typedSignLabel: "Sign",
  typedReject: "Reject",
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
  balTabLabel: "Balances",
  receiveLabel: "Receive",
  receiveTitle: "Receive",
  receiveBody: "Scan this QR code or copy your {chainLabel} address.",
  receiveAddressLabel: "Address",
  receiveQrAlt: "{chainLabel} wallet address",
  receiveCopyLabel: "Copy address",
  receiveCopiedLabel: "Address copied",
  receiveCopyFailedLabel: "Copy failed",
  receiveCloseLabel: "Close",
  backupTitle: "Create a backup",
  backupBody: "Encrypt a recovery blob with a passphrase.",
  backupContinue: "Continue",
  backupCancel: "Cancel",
  restoreTitle: "Restore wallet",
  restoreBody: "Paste a backup and enter your passphrase.",
  restoreLabel: "Restore",
  restoreCancel: "Cancel",
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
  backupTitle: "Backup Ocean keys",
  restoreTitle: "Restore Ocean wallet",
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
  signTitle: "Sign message",
  signLabel: "Sign",
  typedTitle: "Sign typed data",
  typedSignLabel: "Sign",
  txTitle: "Send transaction",
  txSignLabel: "Sign",
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
  balTabLabel: "Balances",
  receiveLabel: "Receive",
  receiveTitle: "Receive",
  receiveBody: "Scan this QR code or copy your {chainLabel} address.",
  receiveAddressLabel: "Address",
  receiveQrAlt: "{chainLabel} wallet address",
  receiveCopyLabel: "Copy address",
  receiveCopiedLabel: "Address copied",
  receiveCopyFailedLabel: "Copy failed",
  receiveCloseLabel: "Close",
  backupTitle: "Create backup",
  backupBody: "",
  restoreTitle: "Restore backup",
  restoreBody: "",
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
  if (Object.keys(walletSetup).length > 0) copy.walletSetup = walletSetup;

  const passkeyName: Record<string, string> = {};
  put(passkeyName, "title", form.passkeyTitle);
  put(passkeyName, "body", form.passkeyBody);
  put(passkeyName, "continueLabel", form.passkeyContinue);
  put(passkeyName, "cancelLabel", form.passkeyCancel);
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

  const sendTransaction: Record<string, string> = {};
  put(sendTransaction, "title", form.txTitle);
  put(sendTransaction, "signLabel", form.txSignLabel);
  put(sendTransaction, "rejectLabel", form.txReject);
  if (Object.keys(sendTransaction).length > 0) {
    copy.sendTransaction = sendTransaction;
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

  const balances: Record<string, string> = {};
  put(balances, "tabLabel", form.balTabLabel);
  put(balances, "receiveLabel", form.receiveLabel);
  put(balances, "receiveTitle", form.receiveTitle);
  put(balances, "receiveBody", form.receiveBody);
  put(balances, "receiveAddressLabel", form.receiveAddressLabel);
  put(balances, "receiveQrAlt", form.receiveQrAlt);
  put(balances, "receiveCopyLabel", form.receiveCopyLabel);
  put(balances, "receiveCopiedLabel", form.receiveCopiedLabel);
  put(balances, "receiveCopyFailedLabel", form.receiveCopyFailedLabel);
  put(balances, "receiveCloseLabel", form.receiveCloseLabel);
  if (Object.keys(balances).length > 0) copy.balances = balances;

  const createBackup: Record<string, string> = {};
  put(createBackup, "title", form.backupTitle);
  put(createBackup, "body", form.backupBody);
  put(createBackup, "continueLabel", form.backupContinue);
  put(createBackup, "cancelLabel", form.backupCancel);
  if (Object.keys(createBackup).length > 0) copy.createBackup = createBackup;

  const restoreBackup: Record<string, string> = {};
  put(restoreBackup, "title", form.restoreTitle);
  put(restoreBackup, "body", form.restoreBody);
  put(restoreBackup, "restoreLabel", form.restoreLabel);
  put(restoreBackup, "cancelLabel", form.restoreCancel);
  if (Object.keys(restoreBackup).length > 0) {
    copy.restoreBackup = restoreBackup;
  }

  const payload: Record<string, unknown> = { dark: form.dark };
  if (Object.keys(theme).length > 0) payload.theme = theme;
  if (Object.keys(copy).length > 0) payload.copy = copy;
  return payload;
}
