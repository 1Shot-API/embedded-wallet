import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import { PaymentFeePicker } from "./PaymentFeePicker";
import type { useRelayerConfirmSubmit } from "./useRelayerConfirmSubmit";

type RelayerSubmitState = ReturnType<typeof useRelayerConfirmSubmit>;

/** Shared relayer fee UI for confirm modals (estimate → final fee → status). */
export function RelayerConfirmModalChrome({
  chainId,
  ownerAddress,
  submit,
}: {
  chainId: EVMChainId;
  ownerAddress: EVMAccountAddress;
  submit: RelayerSubmitState;
}) {
  return (
    <>
      {submit.phase === "finalFee" ? (
        <p className="text-muted-foreground mt-3 m-0 text-sm">
          {submit.finalFeeNotice}
        </p>
      ) : null}
      <PaymentFeePicker
        chainId={chainId}
        ownerAddress={ownerAddress}
        quote={submit.quote}
        error={submit.quoteError}
        loading={false}
        paused={submit.feePickerPaused}
        mode={submit.feePickerMode}
        finalFee={submit.finalFee}
        onQuoteChange={(next, err) => {
          submit.setQuote(next);
          submit.setQuoteError(err);
        }}
      />
      {submit.statusMessage ? (
        <p className="text-muted-foreground mt-4 m-0 text-[0.9rem]">
          {submit.statusMessage}
        </p>
      ) : null}
      {submit.error ? (
        <p className="text-destructive mt-3 m-0 text-[0.9rem]">{submit.error}</p>
      ) : null}
    </>
  );
}
