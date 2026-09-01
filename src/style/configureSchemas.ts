import { z } from "zod";

/**
 * Definitive `configure` / style shapes for the Branding Layer.
 *
 * Resolved copy/theme types are `z.infer` of these schemas. The RPC patch
 * schema is built with `.partial()` so hosts may omit any key. Do not
 * re-declare parallel interfaces in `types.ts` — extend the schema here.
 */

export const styleThemeSchema = z.strictObject({
  primary: z.string(),
  primaryForeground: z.string(),
  background: z.string(),
  foreground: z.string(),
  muted: z.string(),
  mutedForeground: z.string(),
  border: z.string(),
  accent: z.string(),
  accentForeground: z.string(),
  radius: z.string(),
  fontSans: z.string(),
});

export const styleCopyAccountSchema = z.strictObject({
  selectNetworkTitle: z.string(),
  selectNetworkCancelLabel: z.string(),
  copyAddressLabel: z.string(),
  addressCopiedLabel: z.string(),
  addressCopyFailedLabel: z.string(),
});

export const styleCopyConnectSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  rejectLabel: z.string(),
  continueLabel: z.string(),
});

export const styleCopyWalletSetupSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  cancelLabel: z.string(),
  loginLabel: z.string(),
  createLabel: z.string(),
  passkeyTimeoutError: z.string(),
  passkeyFailedError: z.string(),
});

export const styleCopyPasskeyNameSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  fieldLabel: z.string(),
  placeholder: z.string(),
  emptyError: z.string(),
  termsAcceptancePrefix: z.string(),
  termsOfServiceLabel: z.string(),
  termsAcceptanceJoiner: z.string(),
  privacyPolicyLabel: z.string(),
  termsAcceptanceError: z.string(),
  termsOfServiceUrl: z.url(),
  privacyPolicyUrl: z.url(),
  cancelLabel: z.string(),
  continueLabel: z.string(),
});

export const styleCopyPersonalSignSchema = z.strictObject({
  title: z.string(),
  accountLabel: z.string(),
  messageLabel: z.string(),
  rejectLabel: z.string(),
  signLabel: z.string(),
});

export const styleCopySiweSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  estimatedChangesLabel: z.string(),
  noChangesLabel: z.string(),
  networkLabel: z.string(),
  requestFromLabel: z.string(),
  signingInWithLabel: z.string(),
  messageLabel: z.string(),
  uriLabel: z.string(),
  rejectLabel: z.string(),
  signLabel: z.string(),
  signingHint: z.string(),
});

export const styleCopyTypedDataSchema = z.strictObject({
  title: z.string(),
  accountLabel: z.string(),
  primaryTypeLabel: z.string(),
  domainLabel: z.string(),
  messageLabel: z.string(),
  rejectLabel: z.string(),
  signLabel: z.string(),
});

export const styleCopySendTransactionSchema = z.strictObject({
  title: z.string(),
  accountLabel: z.string(),
  contractLabel: z.string(),
  contractCreationLabel: z.string(),
  valueLabel: z.string(),
  dataLabel: z.string(),
  chainLabel: z.string(),
  rejectLabel: z.string(),
  signLabel: z.string(),
});

export const styleCopyConfirmTransferSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  amountLabel: z.string(),
  tokenLabel: z.string(),
  receiverLabel: z.string(),
  chainLabel: z.string(),
  rejectLabel: z.string(),
  confirmLabel: z.string(),
});

export const styleCopyTransferTokensSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  amountLabel: z.string(),
  amountPlaceholder: z.string(),
  recipientLabel: z.string(),
  recipientPlaceholder: z.string(),
  scanQrLabel: z.string(),
  cancelLabel: z.string(),
  sendLabel: z.string(),
  invalidAmountError: z.string(),
  insufficientBalanceError: z.string(),
  invalidAddressError: z.string(),
  sendFailedError: z.string(),
  sentTitle: z.string(),
  sentBody: z.string(),
  hashLabel: z.string(),
  copyHashLabel: z.string(),
  hashCopiedLabel: z.string(),
  hashCopyFailedLabel: z.string(),
  viewOnExplorerLabel: z.string(),
  doneLabel: z.string(),
});

export const styleCopyCctpBridgeSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  confirmTitle: z.string(),
  confirmBody: z.string(),
  amountLabel: z.string(),
  amountPlaceholder: z.string(),
  sourceChainLabel: z.string(),
  destinationLabel: z.string(),
  destinationPlaceholder: z.string(),
  speedLabel: z.string(),
  speedFastLabel: z.string(),
  speedSlowLabel: z.string(),
  recipientLabel: z.string(),
  recipientHint: z.string(),
  getQuoteLabel: z.string(),
  confirmLabel: z.string(),
  cancelLabel: z.string(),
  backLabel: z.string(),
  retryLabel: z.string(),
  transferAmountLabel: z.string(),
  forwardFeeLabel: z.string(),
  protocolFeeLabel: z.string(),
  cctpFeeLabel: z.string(),
  relayerFeeLabel: z.string(),
  totalBurnLabel: z.string(),
  netReceivedLabel: z.string(),
  quotingLabel: z.string(),
  submittingLabel: z.string(),
  pollingLabel: z.string(),
  sourceHashLabel: z.string(),
  destHashLabel: z.string(),
  successTitle: z.string(),
  successBody: z.string(),
  quoteFailedError: z.string(),
  submitFailedError: z.string(),
  timeoutError: z.string(),
  insufficientBalanceError: z.string(),
  invalidAmountError: z.string(),
  noDestinationError: z.string(),
  viewOnExplorerLabel: z.string(),
  doneLabel: z.string(),
});

export const styleCopyGrantExecutionPermissionSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  hostLabel: z.string(),
  toLabel: z.string(),
  chainLabel: z.string(),
  permissionTypeLabel: z.string(),
  tokenLabel: z.string(),
  periodAmountLabel: z.string(),
  periodAmountPlaceholder: z.string(),
  periodDurationLabel: z.string(),
  periodDurationPlaceholder: z.string(),
  periodDurationHint: z.string(),
  startLabel: z.string(),
  memoLabel: z.string(),
  memoPlaceholder: z.string(),
  invalidAmountError: z.string(),
  invalidDurationError: z.string(),
  rejectLabel: z.string(),
  grantLabel: z.string(),
});

export const styleCopyCancelDelegationSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  hostLabel: z.string(),
  chainLabel: z.string(),
  rejectLabel: z.string(),
  confirmLabel: z.string(),
  signingMessage: z.string(),
  waitingMessage: z.string(),
});

export const styleCopyPasskeyPromptEntrySchema = z.strictObject({
  title: z.string(),
  body: z.string(),
});

export const styleCopyPasskeyPromptSchema = z.strictObject({
  unlock: styleCopyPasskeyPromptEntrySchema,
  create: styleCopyPasskeyPromptEntrySchema,
  sign: styleCopyPasskeyPromptEntrySchema,
  encrypt: styleCopyPasskeyPromptEntrySchema,
  decrypt: styleCopyPasskeyPromptEntrySchema,
  relayerAuth: styleCopyPasskeyPromptEntrySchema,
  walletUpgrade: styleCopyPasskeyPromptEntrySchema,
  approveTransaction: styleCopyPasskeyPromptEntrySchema,
  adjustFee: styleCopyPasskeyPromptEntrySchema,
  backup: styleCopyPasskeyPromptEntrySchema,
  exportPrivateKey: styleCopyPasskeyPromptEntrySchema,
});

export const styleCopyCredentialOfferSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  offeredHeading: z.string(),
  passkeyNote: z.string(),
  rejectLabel: z.string(),
  acceptLabel: z.string(),
});

export const styleCopyCredentialPresentationSchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  credentialDetail: z.string(),
  claimsHeading: z.string(),
  passkeyNote: z.string(),
  rejectLabel: z.string(),
  shareLabel: z.string(),
});

export const styleCopyCredentialsSchema = z.strictObject({
  tabLabel: z.string(),
  emptyCountLabel: z.string(),
  countLabel: z.string(),
  refreshLabel: z.string(),
  loadingBody: z.string(),
  emptyBody: z.string(),
  loadFailedError: z.string(),
  refreshFailedError: z.string(),
  notFoundError: z.string(),
  openFailedError: z.string(),
  typeColumn: z.string(),
  issuerColumn: z.string(),
  issuedColumn: z.string(),
  viewLabel: z.string(),
  detailFallbackTitle: z.string(),
  detailDescription: z.string(),
  issuerLabel: z.string(),
  formatLabel: z.string(),
  issuedLabel: z.string(),
  validUntilLabel: z.string(),
  idLabel: z.string(),
  claimsHeading: z.string(),
  claimsLoading: z.string(),
  claimsEmpty: z.string(),
  closeLabel: z.string(),
});

export const styleCopyDelegationsSchema = z.strictObject({
  tabLabel: z.string(),
  emptyCountLabel: z.string(),
  countLabel: z.string(),
  refreshLabel: z.string(),
  loadingBody: z.string(),
  emptyBody: z.string(),
  loadFailedError: z.string(),
  refreshFailedError: z.string(),
  cancelFailedError: z.string(),
  notFoundError: z.string(),
  cancelLabel: z.string(),
  noMemoLabel: z.string(),
  periodSummary: z.string(),
  permissionSummary: z.string(),
});

export const styleCopyBalancesSchema = z.strictObject({
  tabLabel: z.string(),
  emptyCountLabel: z.string(),
  countLabel: z.string(),
  addLabel: z.string(),
  refreshLabel: z.string(),
  loadingBody: z.string(),
  emptyBody: z.string(),
  loadFailedError: z.string(),
  refreshFailedError: z.string(),
  addFailedError: z.string(),
  invalidAddressError: z.string(),
  assetColumn: z.string(),
  chainColumn: z.string(),
  balanceColumn: z.string(),
  viewLabel: z.string(),
  closeLabel: z.string(),
  addDialogTitle: z.string(),
  addDialogBody: z.string(),
  addressLabel: z.string(),
  addressPlaceholder: z.string(),
  addDialogCancelLabel: z.string(),
  addDialogSubmitLabel: z.string(),
  addConfirmTitle: z.string(),
  addConfirmBody: z.string(),
  addConfirmWarning: z.string(),
  addConfirmRejectLabel: z.string(),
  addConfirmAcceptLabel: z.string(),
  balanceUnavailable: z.string(),
  balanceNonErc20: z.string(),
  receiveLabel: z.string(),
  receiveTitle: z.string(),
  receiveBody: z.string(),
  receiveAddressLabel: z.string(),
  receiveQrAlt: z.string(),
  receiveCopyLabel: z.string(),
  receiveCopiedLabel: z.string(),
  receiveCopyFailedLabel: z.string(),
  receiveCloseLabel: z.string(),
  sendLabel: z.string(),
  bridgeLabel: z.string(),
});

export const styleCopyExportPrivateKeySchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  continueLabel: z.string(),
  cancelLabel: z.string(),
  closeLabel: z.string(),
  revealingBody: z.string(),
  cancelledError: z.string(),
  failedError: z.string(),
});

export const styleCopyImportPrivateKeySchema = z.strictObject({
  title: z.string(),
  body: z.string(),
  continueLabel: z.string(),
  cancelLabel: z.string(),
  closeLabel: z.string(),
  importingBody: z.string(),
  cancelledError: z.string(),
  invalidKeyError: z.string(),
  failedError: z.string(),
});

export const styleCopyAdvancedOptionsSchema = z.strictObject({
  title: z.string(),
  menuLabel: z.string(),
  onboardingLabel: z.string(),
  body: z.string(),
  exportLabel: z.string(),
  importLabel: z.string(),
  changeAccountLabel: z.string(),
  closeLabel: z.string(),
});

export const styleCopyResolvedSchema = z.strictObject({
  productName: z.string(),
  tagline: z.string(),
  logoUrl: z.string(),
  account: styleCopyAccountSchema,
  connect: styleCopyConnectSchema,
  walletSetup: styleCopyWalletSetupSchema,
  passkeyName: styleCopyPasskeyNameSchema,
  personalSign: styleCopyPersonalSignSchema,
  siwe: styleCopySiweSchema,
  typedData: styleCopyTypedDataSchema,
  sendTransaction: styleCopySendTransactionSchema,
  confirmTransfer: styleCopyConfirmTransferSchema,
  transferTokens: styleCopyTransferTokensSchema,
  cctpBridge: styleCopyCctpBridgeSchema,
  grantExecutionPermission: styleCopyGrantExecutionPermissionSchema,
  cancelDelegation: styleCopyCancelDelegationSchema,
  passkeyPrompt: styleCopyPasskeyPromptSchema,
  credentialOffer: styleCopyCredentialOfferSchema,
  credentialPresentation: styleCopyCredentialPresentationSchema,
  credentials: styleCopyCredentialsSchema,
  delegations: styleCopyDelegationsSchema,
  balances: styleCopyBalancesSchema,
  exportPrivateKey: styleCopyExportPrivateKeySchema,
  importPrivateKey: styleCopyImportPrivateKeySchema,
  advancedOptions: styleCopyAdvancedOptionsSchema,
});

const passkeyPromptPatchSchema = z.strictObject({
  unlock: styleCopyPasskeyPromptEntrySchema.partial().optional(),
  create: styleCopyPasskeyPromptEntrySchema.partial().optional(),
  sign: styleCopyPasskeyPromptEntrySchema.partial().optional(),
  encrypt: styleCopyPasskeyPromptEntrySchema.partial().optional(),
  decrypt: styleCopyPasskeyPromptEntrySchema.partial().optional(),
  relayerAuth: styleCopyPasskeyPromptEntrySchema.partial().optional(),
  walletUpgrade: styleCopyPasskeyPromptEntrySchema.partial().optional(),
  approveTransaction: styleCopyPasskeyPromptEntrySchema.partial().optional(),
  adjustFee: styleCopyPasskeyPromptEntrySchema.partial().optional(),
  backup: styleCopyPasskeyPromptEntrySchema.partial().optional(),
  exportPrivateKey: styleCopyPasskeyPromptEntrySchema.partial().optional(),
});

export const styleCopyPatchSchema = z.strictObject({
  productName: z.string().optional(),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  account: styleCopyAccountSchema.partial().optional(),
  connect: styleCopyConnectSchema.partial().optional(),
  walletSetup: styleCopyWalletSetupSchema.partial().optional(),
  passkeyName: styleCopyPasskeyNameSchema.partial().optional(),
  personalSign: styleCopyPersonalSignSchema.partial().optional(),
  siwe: styleCopySiweSchema.partial().optional(),
  typedData: styleCopyTypedDataSchema.partial().optional(),
  sendTransaction: styleCopySendTransactionSchema.partial().optional(),
  confirmTransfer: styleCopyConfirmTransferSchema.partial().optional(),
  transferTokens: styleCopyTransferTokensSchema.partial().optional(),
  cctpBridge: styleCopyCctpBridgeSchema.partial().optional(),
  grantExecutionPermission:
    styleCopyGrantExecutionPermissionSchema.partial().optional(),
  cancelDelegation: styleCopyCancelDelegationSchema.partial().optional(),
  passkeyPrompt: passkeyPromptPatchSchema.optional(),
  credentialOffer: styleCopyCredentialOfferSchema.partial().optional(),
  credentialPresentation:
    styleCopyCredentialPresentationSchema.partial().optional(),
  credentials: styleCopyCredentialsSchema.partial().optional(),
  delegations: styleCopyDelegationsSchema.partial().optional(),
  balances: styleCopyBalancesSchema.partial().optional(),
  exportPrivateKey: styleCopyExportPrivateKeySchema.partial().optional(),
  importPrivateKey: styleCopyImportPrivateKeySchema.partial().optional(),
  advancedOptions: styleCopyAdvancedOptionsSchema.partial().optional(),
});

export const styleFeaturesPatchSchema = z.strictObject({
  hideCloseBox: z.boolean().optional(),
  disableCredentials: z.boolean().optional(),
  disableDelegations: z.boolean().optional(),
  allowedChains: z.array(z.string().regex(/^0x[0-9a-fA-F]+$/)).optional(),
});

/**
 * Host `configure` RPC params. Every key optional; omitted keys keep the
 * previous / default value. `destinationUrl` of `null` or `""` clears.
 */
export const configureParamsSchema = z.strictObject({
  theme: styleThemeSchema.partial().optional(),
  copy: styleCopyPatchSchema.optional(),
  dark: z.boolean().optional(),
  features: styleFeaturesPatchSchema.optional(),
  destinationUrl: z
    .union([z.url().max(256), z.literal(""), z.null()])
    .optional(),
});

export type IStyleThemeResolved = z.infer<typeof styleThemeSchema>;
export type IStyleThemeOptions = Partial<IStyleThemeResolved>;
export type IStyleCopyAccount = z.infer<typeof styleCopyAccountSchema>;
export type IStyleCopyConnect = z.infer<typeof styleCopyConnectSchema>;
export type IStyleCopyWalletSetup = z.infer<typeof styleCopyWalletSetupSchema>;
export type IStyleCopyPasskeyName = z.infer<typeof styleCopyPasskeyNameSchema>;
export type IStyleCopyPersonalSign = z.infer<typeof styleCopyPersonalSignSchema>;
export type IStyleCopySiwe = z.infer<typeof styleCopySiweSchema>;
export type IStyleCopyTypedData = z.infer<typeof styleCopyTypedDataSchema>;
export type IStyleCopySendTransaction = z.infer<
  typeof styleCopySendTransactionSchema
>;
export type IStyleCopyConfirmTransfer = z.infer<
  typeof styleCopyConfirmTransferSchema
>;
export type IStyleCopyTransferTokens = z.infer<
  typeof styleCopyTransferTokensSchema
>;
export type IStyleCopyCctpBridge = z.infer<typeof styleCopyCctpBridgeSchema>;
export type IStyleCopyGrantExecutionPermission = z.infer<
  typeof styleCopyGrantExecutionPermissionSchema
>;
export type IStyleCopyCancelDelegation = z.infer<
  typeof styleCopyCancelDelegationSchema
>;
export type IStyleCopyPasskeyPromptEntry = z.infer<
  typeof styleCopyPasskeyPromptEntrySchema
>;
export type IStyleCopyPasskeyPrompt = z.infer<
  typeof styleCopyPasskeyPromptSchema
>;
export type IStyleCopyCredentialOffer = z.infer<
  typeof styleCopyCredentialOfferSchema
>;
export type IStyleCopyCredentialPresentation = z.infer<
  typeof styleCopyCredentialPresentationSchema
>;
export type IStyleCopyCredentials = z.infer<typeof styleCopyCredentialsSchema>;
export type IStyleCopyDelegations = z.infer<typeof styleCopyDelegationsSchema>;
export type IStyleCopyBalances = z.infer<typeof styleCopyBalancesSchema>;
export type IStyleCopyExportPrivateKey = z.infer<
  typeof styleCopyExportPrivateKeySchema
>;
export type IStyleCopyImportPrivateKey = z.infer<
  typeof styleCopyImportPrivateKeySchema
>;
export type IStyleCopyAdvancedOptions = z.infer<
  typeof styleCopyAdvancedOptionsSchema
>;
export type IStyleCopyOptions = z.infer<typeof styleCopyPatchSchema>;
export type IResolvedCopy = z.infer<typeof styleCopyResolvedSchema>;
export type IStyleFeaturesOptions = z.infer<typeof styleFeaturesPatchSchema>;
export type IStyleOptions = z.infer<typeof configureParamsSchema>;
export type IConfigureParams = IStyleOptions;
