/** Flat form state for the host style playground (organization can come later). */
export interface IStyleFormState {
  productName: string;
  tagline: string;
  connectTitle: string;
  connectContinue: string;
  setupTitle: string;
  setupCreate: string;
  passkeyTitle: string;
  passkeyContinue: string;
  signTitle: string;
  signLabel: string;
  typedTitle: string;
  credOfferTitle: string;
  credPresentTitle: string;
  credListTitle: string;
  backupTitle: string;
  restoreTitle: string;
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  radius: string;
  dark: boolean;
}

export const ACME_PRESET: IStyleFormState = {
  productName: "Acme Wallet",
  tagline: "Powered by 1Shot",
  connectTitle: "Connect to Acme",
  connectContinue: "Allow",
  setupTitle: "Welcome to Acme",
  setupCreate: "Get started",
  passkeyTitle: "Name this passkey",
  passkeyContinue: "Save name",
  signTitle: "Approve signature",
  signLabel: "Sign",
  typedTitle: "Approve typed data",
  credOfferTitle: "Accept this credential?",
  credPresentTitle: "Share this credential?",
  credListTitle: "Credentials",
  backupTitle: "Create a backup",
  restoreTitle: "Restore wallet",
  primary: "oklch(0.45 0.18 250)",
  primaryForeground: "oklch(0.99 0 0)",
  background: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  radius: "0.625rem",
  dark: false,
};

export const OCEAN_PRESET: IStyleFormState = {
  productName: "Ocean Wallet",
  tagline: "Host setStyle preset",
  connectTitle: "Connect to Ocean",
  connectContinue: "Allow",
  setupTitle: "Welcome aboard",
  setupCreate: "Create Ocean account",
  passkeyTitle: "Name your Ocean passkey",
  passkeyContinue: "Save name",
  signTitle: "Sign with Ocean",
  signLabel: "Approve",
  typedTitle: "Ocean typed data",
  credOfferTitle: "Accept Ocean credential?",
  credPresentTitle: "Share with verifier?",
  credListTitle: "Ocean credentials",
  backupTitle: "Backup Ocean keys",
  restoreTitle: "Restore Ocean wallet",
  primary: "oklch(0.45 0.18 250)",
  primaryForeground: "oklch(0.99 0 0)",
  background: "oklch(0.98 0.01 250)",
  foreground: "oklch(0.2 0.04 250)",
  radius: "0.75rem",
  dark: false,
};

export const DEFAULTS_PRESET: IStyleFormState = {
  productName: "1Shot Wallet",
  tagline: "Passkey-secured embedded wallet",
  connectTitle: "Connect wallet",
  connectContinue: "Continue",
  setupTitle: "Set up your wallet",
  setupCreate: "Create account",
  passkeyTitle: "Name your passkey",
  passkeyContinue: "Continue",
  signTitle: "Sign message",
  signLabel: "Sign",
  typedTitle: "Sign typed data",
  credOfferTitle: "Accept credential offer?",
  credPresentTitle: "Share credential?",
  credListTitle: "My credentials",
  backupTitle: "Create backup",
  restoreTitle: "Restore backup",
  primary: "oklch(0.205 0 0)",
  primaryForeground: "oklch(0.985 0 0)",
  background: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  radius: "0.625rem",
  dark: false,
};

/** Build a `setStyle` RPC payload from the flat form (omit empty theme/copy keys). */
export function buildSetStylePayload(
  form: IStyleFormState,
): Record<string, unknown> {
  const theme: Record<string, string> = {};
  const primary = form.primary.trim();
  const primaryForeground = form.primaryForeground.trim();
  const background = form.background.trim();
  const foreground = form.foreground.trim();
  const radius = form.radius.trim();
  if (primary) theme.primary = primary;
  if (primaryForeground) theme.primaryForeground = primaryForeground;
  if (background) theme.background = background;
  if (foreground) theme.foreground = foreground;
  if (radius) theme.radius = radius;

  const copy: Record<string, unknown> = {};
  const productName = form.productName.trim();
  const tagline = form.tagline.trim();
  if (productName) copy.productName = productName;
  if (tagline) copy.tagline = tagline;

  const connect: Record<string, string> = {};
  if (form.connectTitle.trim()) connect.title = form.connectTitle.trim();
  if (form.connectContinue.trim()) {
    connect.continueLabel = form.connectContinue.trim();
  }
  if (Object.keys(connect).length > 0) copy.connect = connect;

  const walletSetup: Record<string, string> = {};
  if (form.setupTitle.trim()) walletSetup.title = form.setupTitle.trim();
  if (form.setupCreate.trim()) {
    walletSetup.createLabel = form.setupCreate.trim();
  }
  if (Object.keys(walletSetup).length > 0) copy.walletSetup = walletSetup;

  const passkeyName: Record<string, string> = {};
  if (form.passkeyTitle.trim()) passkeyName.title = form.passkeyTitle.trim();
  if (form.passkeyContinue.trim()) {
    passkeyName.continueLabel = form.passkeyContinue.trim();
  }
  if (Object.keys(passkeyName).length > 0) copy.passkeyName = passkeyName;

  const personalSign: Record<string, string> = {};
  if (form.signTitle.trim()) personalSign.title = form.signTitle.trim();
  if (form.signLabel.trim()) personalSign.signLabel = form.signLabel.trim();
  if (Object.keys(personalSign).length > 0) copy.personalSign = personalSign;

  const typedData: Record<string, string> = {};
  if (form.typedTitle.trim()) typedData.title = form.typedTitle.trim();
  if (form.signLabel.trim()) typedData.signLabel = form.signLabel.trim();
  if (Object.keys(typedData).length > 0) copy.typedData = typedData;

  if (form.credOfferTitle.trim()) {
    copy.credentialOffer = { title: form.credOfferTitle.trim() };
  }
  if (form.credPresentTitle.trim()) {
    copy.credentialPresentation = { title: form.credPresentTitle.trim() };
  }
  if (form.credListTitle.trim()) {
    copy.credentialList = { title: form.credListTitle.trim() };
  }
  if (form.backupTitle.trim()) {
    copy.createBackup = { title: form.backupTitle.trim() };
  }
  if (form.restoreTitle.trim()) {
    copy.restoreBackup = { title: form.restoreTitle.trim() };
  }

  const payload: Record<string, unknown> = { dark: form.dark };
  if (Object.keys(theme).length > 0) payload.theme = theme;
  if (Object.keys(copy).length > 0) payload.copy = copy;
  return payload;
}
