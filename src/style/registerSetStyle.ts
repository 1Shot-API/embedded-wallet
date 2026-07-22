import { z } from "zod";
import { EVMChainId } from "@1shotapi/ows-types";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import type { IChainRepository } from "../lib/interfaces/data/IChainRepository";
import { styleController } from "./styleController";

/** Custom RPC method name — host: `await proxy.rpc("setStyle", options)`. */
export const SET_STYLE_RPC_METHOD = "setStyle";

const themeSchema = z
  .object({
    primary: z.string().optional(),
    primaryForeground: z.string().optional(),
    background: z.string().optional(),
    foreground: z.string().optional(),
    muted: z.string().optional(),
    mutedForeground: z.string().optional(),
    border: z.string().optional(),
    accent: z.string().optional(),
    accentForeground: z.string().optional(),
    radius: z.string().optional(),
    fontSans: z.string().optional(),
  })
  .strict()
  .optional();

const connectCopySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
    rejectLabel: z.string().optional(),
    continueLabel: z.string().optional(),
  })
  .strict()
  .optional();

const walletSetupCopySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
    cancelLabel: z.string().optional(),
    loginLabel: z.string().optional(),
    createLabel: z.string().optional(),
  })
  .strict()
  .optional();

const passkeyNameCopySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
    fieldLabel: z.string().optional(),
    placeholder: z.string().optional(),
    emptyError: z.string().optional(),
    cancelLabel: z.string().optional(),
    continueLabel: z.string().optional(),
  })
  .strict()
  .optional();

const personalSignCopySchema = z
  .object({
    title: z.string().optional(),
    accountLabel: z.string().optional(),
    messageLabel: z.string().optional(),
    rejectLabel: z.string().optional(),
    signLabel: z.string().optional(),
  })
  .strict()
  .optional();

const typedDataCopySchema = z
  .object({
    title: z.string().optional(),
    accountLabel: z.string().optional(),
    primaryTypeLabel: z.string().optional(),
    domainLabel: z.string().optional(),
    messageLabel: z.string().optional(),
    rejectLabel: z.string().optional(),
    signLabel: z.string().optional(),
  })
  .strict()
  .optional();

const sendTransactionCopySchema = z
  .object({
    title: z.string().optional(),
    accountLabel: z.string().optional(),
    contractLabel: z.string().optional(),
    contractCreationLabel: z.string().optional(),
    valueLabel: z.string().optional(),
    dataLabel: z.string().optional(),
    chainLabel: z.string().optional(),
    rejectLabel: z.string().optional(),
    signLabel: z.string().optional(),
  })
  .strict()
  .optional();

const confirmTransferCopySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
    amountLabel: z.string().optional(),
    tokenLabel: z.string().optional(),
    receiverLabel: z.string().optional(),
    chainLabel: z.string().optional(),
    rejectLabel: z.string().optional(),
    confirmLabel: z.string().optional(),
  })
  .strict()
  .optional();

const transferTokensCopySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
    amountLabel: z.string().optional(),
    amountPlaceholder: z.string().optional(),
    recipientLabel: z.string().optional(),
    recipientPlaceholder: z.string().optional(),
    scanQrLabel: z.string().optional(),
    cancelLabel: z.string().optional(),
    sendLabel: z.string().optional(),
    invalidAmountError: z.string().optional(),
    insufficientBalanceError: z.string().optional(),
    invalidAddressError: z.string().optional(),
    sendFailedError: z.string().optional(),
    sentTitle: z.string().optional(),
    sentBody: z.string().optional(),
    hashLabel: z.string().optional(),
    copyHashLabel: z.string().optional(),
    hashCopiedLabel: z.string().optional(),
    hashCopyFailedLabel: z.string().optional(),
    viewOnExplorerLabel: z.string().optional(),
    doneLabel: z.string().optional(),
  })
  .strict()
  .optional();

const passkeyPromptEntrySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
  })
  .strict()
  .optional();

const passkeyPromptCopySchema = z
  .object({
    unlock: passkeyPromptEntrySchema,
    create: passkeyPromptEntrySchema,
    sign: passkeyPromptEntrySchema,
    encrypt: passkeyPromptEntrySchema,
    decrypt: passkeyPromptEntrySchema,
    relayerAuth: passkeyPromptEntrySchema,
    backup: passkeyPromptEntrySchema,
  })
  .strict()
  .optional();

const credentialOfferCopySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
    offeredHeading: z.string().optional(),
    passkeyNote: z.string().optional(),
    rejectLabel: z.string().optional(),
    acceptLabel: z.string().optional(),
  })
  .strict()
  .optional();

const credentialPresentationCopySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
    credentialDetail: z.string().optional(),
    claimsHeading: z.string().optional(),
    passkeyNote: z.string().optional(),
    rejectLabel: z.string().optional(),
    shareLabel: z.string().optional(),
  })
  .strict()
  .optional();

const credentialsCopySchema = z
  .object({
    tabLabel: z.string().optional(),
    emptyCountLabel: z.string().optional(),
    countLabel: z.string().optional(),
    refreshLabel: z.string().optional(),
    loadingBody: z.string().optional(),
    emptyBody: z.string().optional(),
    loadFailedError: z.string().optional(),
    refreshFailedError: z.string().optional(),
    notFoundError: z.string().optional(),
    openFailedError: z.string().optional(),
    typeColumn: z.string().optional(),
    issuerColumn: z.string().optional(),
    issuedColumn: z.string().optional(),
    viewLabel: z.string().optional(),
    detailFallbackTitle: z.string().optional(),
    detailDescription: z.string().optional(),
    issuerLabel: z.string().optional(),
    formatLabel: z.string().optional(),
    issuedLabel: z.string().optional(),
    validUntilLabel: z.string().optional(),
    idLabel: z.string().optional(),
    claimsHeading: z.string().optional(),
    claimsLoading: z.string().optional(),
    claimsEmpty: z.string().optional(),
    closeLabel: z.string().optional(),
  })
  .strict()
  .optional();

const balancesCopySchema = z
  .object({
    tabLabel: z.string().optional(),
    emptyCountLabel: z.string().optional(),
    countLabel: z.string().optional(),
    addLabel: z.string().optional(),
    loadingBody: z.string().optional(),
    emptyBody: z.string().optional(),
    loadFailedError: z.string().optional(),
    addFailedError: z.string().optional(),
    invalidAddressError: z.string().optional(),
    assetColumn: z.string().optional(),
    chainColumn: z.string().optional(),
    balanceColumn: z.string().optional(),
    viewLabel: z.string().optional(),
    closeLabel: z.string().optional(),
    addDialogTitle: z.string().optional(),
    addDialogBody: z.string().optional(),
    addressLabel: z.string().optional(),
    addressPlaceholder: z.string().optional(),
    addDialogCancelLabel: z.string().optional(),
    addDialogSubmitLabel: z.string().optional(),
    addConfirmTitle: z.string().optional(),
    addConfirmBody: z.string().optional(),
    addConfirmRejectLabel: z.string().optional(),
    addConfirmAcceptLabel: z.string().optional(),
    balanceUnavailable: z.string().optional(),
    balanceNonErc20: z.string().optional(),
    receiveLabel: z.string().optional(),
    receiveTitle: z.string().optional(),
    receiveBody: z.string().optional(),
    receiveAddressLabel: z.string().optional(),
    receiveQrAlt: z.string().optional(),
    receiveCopyLabel: z.string().optional(),
    receiveCopiedLabel: z.string().optional(),
    receiveCopyFailedLabel: z.string().optional(),
    receiveCloseLabel: z.string().optional(),
    sendLabel: z.string().optional(),
  })
  .strict()
  .optional();

const createBackupCopySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
    passphrasePrompt: z.string().optional(),
    continueLabel: z.string().optional(),
    cancelLabel: z.string().optional(),
    closeLabel: z.string().optional(),
    copyLabel: z.string().optional(),
    copiedLabel: z.string().optional(),
    copyFailedLabel: z.string().optional(),
    doneLabel: z.string().optional(),
    encryptedLabel: z.string().optional(),
    passwordTooShortError: z.string().optional(),
    cancelledError: z.string().optional(),
    failedError: z.string().optional(),
  })
  .strict()
  .optional();

const restoreBackupCopySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
    passphraseLabel: z.string().optional(),
    restoreLabel: z.string().optional(),
    cancelLabel: z.string().optional(),
    closeLabel: z.string().optional(),
    doneLabel: z.string().optional(),
    successBody: z.string().optional(),
    decryptFailedError: z.string().optional(),
    cancelledError: z.string().optional(),
    failedError: z.string().optional(),
  })
  .strict()
  .optional();

const copySchema = z
  .object({
    productName: z.string().optional(),
    tagline: z.string().optional(),
    logoUrl: z.string().optional(),
    connect: connectCopySchema,
    walletSetup: walletSetupCopySchema,
    passkeyName: passkeyNameCopySchema,
    personalSign: personalSignCopySchema,
    typedData: typedDataCopySchema,
    sendTransaction: sendTransactionCopySchema,
    confirmTransfer: confirmTransferCopySchema,
    transferTokens: transferTokensCopySchema,
    passkeyPrompt: passkeyPromptCopySchema,
    credentialOffer: credentialOfferCopySchema,
    credentialPresentation: credentialPresentationCopySchema,
    credentials: credentialsCopySchema,
    balances: balancesCopySchema,
    createBackup: createBackupCopySchema,
    restoreBackup: restoreBackupCopySchema,
  })
  .strict()
  .optional();

export const setStyleParamsSchema = z
  .object({
    theme: themeSchema,
    copy: copySchema,
    dark: z.boolean().optional(),
    allowedChains: z
      .array(z.string().regex(/^0x[0-9a-fA-F]+$/))
      .optional(),
  })
  .strict();

export type ISetStyleParams = z.infer<typeof setStyleParamsSchema>;

export function registerSetStyleRpc(
  wallet: OWSWallet,
  chainRepository: IChainRepository,
): void {
  wallet.registerRpc(
    SET_STYLE_RPC_METHOD,
    async (params) => {
      const styleParams = params as ISetStyleParams;
      const resolved = styleController.merge(styleParams);
      if (styleParams.allowedChains !== undefined) {
        const catalogIds = new Set(
          chainRepository
            .getCatalog()
            .map((chain) => String(chain.chainId).toLowerCase()),
        );
        const valid = styleParams.allowedChains
          .map((id: string) => id.toLowerCase())
          .filter((id: string) => catalogIds.has(id))
          .map((id: string) => EVMChainId(id as `0x${string}`));
        chainRepository.setAllowedChains(valid.length === 0 ? null : valid);
      }
      return {
        ok: true as const,
        productName: resolved.copy.productName,
      };
    },
    setStyleParamsSchema,
  );
}
