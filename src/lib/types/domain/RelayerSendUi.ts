import type { EVMAccountAddress } from "@1shotapi/ows-types";
import type { TokenAmount } from "../primitives";

/** Relayer-settled fee shown between prepare and submit. */
export type IFinalRelayerFee = {
  feeAtoms: TokenAmount;
  feeFormatted: string;
  paymentToken: EVMAccountAddress;
};

/** Branding-layer hooks for {@link ITransactionUtils.sendViaRelayer}. */
export type IRelayerSendUiCallbacks = {
  /**
   * Called after the first estimate when the relayer fee differs from the UI
   * quote. Resolve when the user re-confirms; reject to abort the send.
   */
  onFinalFeeRequired?: (fee: IFinalRelayerFee) => Promise<void>;
  /** After passkey ceremonies, before relayer submit/poll. */
  onAwaitingConfirmation?: () => void;
  /** Keep the flyout open through submit/poll (in-wallet cancel flows). */
  retainDisplayDuringSubmit?: boolean;
};
