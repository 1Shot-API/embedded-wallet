import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
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
    credentialOffer: credentialOfferCopySchema,
    credentialPresentation: credentialPresentationCopySchema,
    credentials: credentialsCopySchema,
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
  })
  .strict();

export type ISetStyleParams = z.infer<typeof setStyleParamsSchema>;

export function registerSetStyleRpc(wallet: OWSWallet): void {
  wallet.registerRpc(
    SET_STYLE_RPC_METHOD,
    async (params) => {
      const resolved = styleController.merge(params as ISetStyleParams);
      return {
        ok: true as const,
        productName: resolved.copy.productName,
      };
    },
    setStyleParamsSchema,
  );
}
