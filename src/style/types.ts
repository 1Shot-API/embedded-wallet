/**
 * Style / `configure` types.
 *
 * Field lists live in Zod schemas (`configureSchemas.ts`). Types here are
 * re-exports of `z.infer` aliases — do not re-declare parallel interfaces.
 */

export type {
  IStyleThemeResolved,
  IStyleThemeOptions,
  IStyleCopyAccount,
  IStyleCopyConnect,
  IStyleCopyWalletSetup,
  IStyleCopyPasskeyName,
  IStyleCopyPersonalSign,
  IStyleCopySiwe,
  IStyleCopyTypedData,
  IStyleCopySendTransaction,
  IStyleCopyConfirmTransfer,
  IStyleCopyTransferTokens,
  IStyleCopyCctpBridge,
  IStyleCopyGrantExecutionPermission,
  IStyleCopyGrantLiFiSwapPermission,
  IStyleCopyGrantLiFiApprovePermission,
  IStyleCopyCancelDelegation,
  IStyleCopyRelayerSubmit,
  IStyleCopyPasskeyPromptEntry,
  IStyleCopyPasskeyPrompt,
  IStyleCopyCredentialOffer,
  IStyleCopyCredentialPresentation,
  IStyleCopyCredentials,
  IStyleCopyDelegations,
  IStyleCopyBalances,
  IStyleCopyExportPrivateKey,
  IStyleCopyImportPrivateKey,
  IStyleCopyAdvancedOptions,
  IStyleCopyOptions,
  IResolvedCopy,
  IStyleFeaturesOptions,
  IStyleOptions,
  IConfigureParams,
} from "./configureSchemas";

import type { IResolvedCopy, IStyleThemeResolved } from "./configureSchemas";

export interface IResolvedStyleFeatures {
  hideCloseBox: boolean;
  disableCredentials: boolean;
  disableDelegations: boolean;
  /** `null` means no host allowlist (all enabled catalog chains). */
  allowedChains: string[] | null;
}

/** Fully resolved style after merging defaults + configure patches. */
export interface IResolvedStyle {
  theme: IStyleThemeResolved;
  copy: IResolvedCopy;
  dark: boolean;
  features: IResolvedStyleFeatures;
  /** Status webhook URL for the 1Shot Relayer; `null` when unset. */
  destinationUrl: string | null;
}
