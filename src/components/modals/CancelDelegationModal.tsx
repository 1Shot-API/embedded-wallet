import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ICancelDelegationConfirmRequest,
  ICancelDelegationPayment,
} from "../../wallet/modalTypes";
import type { IPaymentQuote } from "../../lib/interfaces/business";
import type { IRelayerSendUiCallbacks } from "../../lib/types/domain/RelayerSendUi";
import type { ITransactionWork } from "../../lib/interfaces/business";
import {
  OwsUserRejectedError,
  type EVMChainId,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import { useStyle } from "../../style/StyleProvider";
import { Modal } from "../Modal";
import { PaymentFeePicker } from "../PaymentFeePicker";
import { isSignDenied } from "../useRelayerConfirmSubmit";

type CancelPhase = "confirm" | "signing" | "finalFee" | "submitting";

type ChainGroup = {
  chainId: EVMChainId;
  chainName: string;
  work: ITransactionWork[];
};

function chainKey(chainId: EVMChainId): string {
  return BigInt(chainId).toString(10);
}

function groupItemsByChain(
  items: ICancelDelegationConfirmRequest["items"],
): ChainGroup[] {
  const map = new Map<string, ChainGroup>();
  for (const item of items) {
    const key = chainKey(item.chainId);
    let group = map.get(key);
    if (!group) {
      group = {
        chainId: item.chainId,
        chainName: item.chainName,
        work: [],
      };
      map.set(key, group);
    }
    group.work.push(item.work);
  }
  return [...map.values()];
}

/**
 * On-chain cancel / revoke confirm — lists selected delegations, quotes a
 * relayer fee per chain, then runs execute. Optional “Skip onchain
 * cancellation” removes vault rows only.
 */
export function CancelDelegationModal({
  request,
  execute,
  executeLocal,
  onRegisterAwaitingConfirmation,
  onResolve,
  onReject,
}: {
  request: ICancelDelegationConfirmRequest;
  execute: (
    payments: ICancelDelegationPayment[],
    ui: IRelayerSendUiCallbacks,
  ) => Promise<EVMTransactionHash[]>;
  executeLocal: () => Promise<void>;
  onRegisterAwaitingConfirmation?: (notify: () => void) => void;
  onResolve: (hashes: EVMTransactionHash[] | null) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const copy = style.copy.cancelDelegation;
  const relayerCopy = style.copy.relayerSubmit;
  const [skipOnchain, setSkipOnchain] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [phase, setPhase] = useState<CancelPhase>("confirm");
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, IPaymentQuote | null>>(
    {},
  );
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string | null>>(
    {},
  );
  const abortedRef = useRef(false);
  const finalFeeGateRef = useRef<{
    resolve: () => void;
    reject: (error: Error) => void;
  } | null>(null);
  const showedFinalFeeRef = useRef(false);
  const [finalFeeLabel, setFinalFeeLabel] = useState<string | null>(null);

  const rejectMessage = "User rejected canceling the permission";
  const chainGroups = useMemo(
    () => groupItemsByChain(request.items),
    [request.items],
  );

  const chainNames = useMemo(
    () =>
      [...new Set(chainGroups.map((g) => g.chainName))].join(", ") ||
      "unknown",
    [chainGroups],
  );

  useEffect(() => {
    onRegisterAwaitingConfirmation?.(() => setPhase("submitting"));
  }, [onRegisterAwaitingConfirmation]);

  useEffect(() => {
    return () => {
      finalFeeGateRef.current?.reject(new OwsUserRejectedError(rejectMessage));
    };
  }, []);

  const allQuotesReady =
    chainGroups.length > 0 &&
    chainGroups.every((group) => {
      const key = chainKey(group.chainId);
      return quotes[key] != null && !quoteErrors[key];
    });

  const showConfirmActions =
    skipOnchain || phase === "confirm" || phase === "finalFee";

  const canConfirm = skipOnchain
    ? !localBusy
    : phase === "finalFee"
      ? true
      : phase === "confirm" && allQuotesReady;

  const body = copy.body
    .replace("{domain}", request.domain)
    .replace("{chainName}", chainNames);

  const setChainQuote = useCallback(
    (chainId: EVMChainId, quote: IPaymentQuote | null, err: string | null) => {
      const key = chainKey(chainId);
      setQuotes((prev) => ({ ...prev, [key]: quote }));
      setQuoteErrors((prev) => ({ ...prev, [key]: err }));
    },
    [],
  );

  const buildPayments = useCallback((): ICancelDelegationPayment[] => {
    return chainGroups.map((group) => {
      const quote = quotes[chainKey(group.chainId)];
      if (!quote) {
        throw new Error(`Missing fee quote for chain ${group.chainName}`);
      }
      return {
        chainId: group.chainId,
        paymentToken: quote.selectedToken,
        feeAtoms: quote.feeAtoms,
        paymentChainId: quote.paymentChainId,
      };
    });
  }, [chainGroups, quotes]);

  const runExecute = useCallback(() => {
    abortedRef.current = false;
    setError(null);
    setPhase("signing");
    let payments: ICancelDelegationPayment[];
    try {
      payments = buildPayments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("confirm");
      return;
    }

    void execute(payments, {
      retainDisplayDuringSubmit: true,
      onAwaitingConfirmation: () => setPhase("submitting"),
      onFinalFeeRequired: (fee) =>
        new Promise<void>((resolve, reject) => {
          showedFinalFeeRef.current = true;
          setFinalFeeLabel(fee.feeFormatted);
          setPhase("finalFee");
          finalFeeGateRef.current = { resolve, reject };
        }),
    })
      .then((hashes) => {
        if (abortedRef.current) return;
        onResolve(hashes);
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return;
        finalFeeGateRef.current = null;
        if (isSignDenied(err)) {
          setPhase(showedFinalFeeRef.current ? "finalFee" : "confirm");
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
        setPhase(showedFinalFeeRef.current ? "finalFee" : "confirm");
      });
  }, [buildPayments, execute, onResolve]);

  const onConfirm = () => {
    if (skipOnchain) {
      setLocalError(null);
      setLocalBusy(true);
      void executeLocal()
        .then(() => onResolve(null))
        .catch((err: unknown) => {
          setLocalBusy(false);
          setLocalError(err instanceof Error ? err.message : String(err));
        });
      return;
    }
    if (phase === "finalFee") {
      if (!finalFeeGateRef.current) return;
      setError(null);
      setPhase("signing");
      finalFeeGateRef.current.resolve();
      finalFeeGateRef.current = null;
      return;
    }
    runExecute();
  };

  const onCancel = () => {
    if (skipOnchain) {
      onReject(new OwsUserRejectedError(rejectMessage));
      return;
    }
    abortedRef.current = true;
    finalFeeGateRef.current?.reject(new OwsUserRejectedError(rejectMessage));
    finalFeeGateRef.current = null;
    onReject(new OwsUserRejectedError(rejectMessage));
  };

  const statusMessage =
    phase === "signing"
      ? relayerCopy.signingMessage
      : phase === "submitting"
        ? relayerCopy.waitingMessage
        : null;

  const feePickerPaused = phase !== "confirm" && phase !== "finalFee";

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={
        skipOnchain
          ? localBusy
            ? undefined
            : onCancel
          : phase === "confirm" || phase === "finalFee"
            ? onCancel
            : undefined
      }
      actions={
        showConfirmActions
          ? [
              {
                label: copy.rejectLabel,
                variant: "secondary",
                onClick: onCancel,
                disabled: skipOnchain ? localBusy : undefined,
              },
              {
                label: copy.confirmLabel,
                variant: "primary",
                autoFocus: true,
                disabled: !canConfirm,
                onClick: onConfirm,
              },
            ]
          : undefined
      }
    >
      <p className="text-muted-foreground m-0 text-sm">{body}</p>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.hostLabel}
          </dt>
          <dd className="text-foreground m-0">{request.domain}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.chainLabel}
          </dt>
          <dd className="text-foreground m-0">{chainNames}</dd>
        </div>
      </dl>

      <ul className="border-border mt-3 m-0 flex list-none flex-col gap-2 border-t pt-3 p-0">
        {request.items.map((item, index) => (
          <li
            key={`${chainKey(item.chainId)}-${index}`}
            className="flex flex-col gap-0.5"
          >
            <p className="text-foreground m-0 truncate text-sm font-medium">
              {item.memo.trim() || "Permission"}
            </p>
            <p className="text-muted-foreground m-0 truncate text-xs">
              {item.chainName}
            </p>
          </li>
        ))}
      </ul>

      {!skipOnchain ? (
        <div className="mt-3 flex flex-col gap-4">
          {phase === "finalFee" ? (
            <p className="text-muted-foreground m-0 text-sm">
              {relayerCopy.finalFeeNotice}
              {finalFeeLabel ? ` (${finalFeeLabel})` : null}
            </p>
          ) : null}
          {chainGroups.map((group) => {
            const key = chainKey(group.chainId);
            return (
              <div key={key} className="flex flex-col gap-1">
                {chainGroups.length > 1 ? (
                  <p className="text-muted-foreground m-0 text-xs font-medium uppercase">
                    {group.chainName}
                  </p>
                ) : null}
                <PaymentFeePicker
                  chainId={group.chainId}
                  ownerAddress={request.ownerAddress}
                  work={group.work}
                  quote={quotes[key] ?? null}
                  error={quoteErrors[key] ?? null}
                  loading={false}
                  paused={feePickerPaused}
                  mode={phase === "finalFee" ? "final" : "estimate"}
                  onQuoteChange={(next, err) => {
                    setChainQuote(group.chainId, next, err);
                  }}
                />
              </div>
            );
          })}
          {statusMessage ? (
            <p className="text-muted-foreground m-0 text-[0.9rem]">
              {statusMessage}
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive m-0 text-[0.9rem]">{error}</p>
          ) : null}
        </div>
      ) : null}

      {request.allowSkipOnchain ? (
        <div className="mt-4">
          <label className="flex cursor-pointer items-start gap-2.5 text-left">
            <input
              type="checkbox"
              className="border-input bg-background text-primary mt-0.5 size-4 shrink-0 rounded border accent-[var(--primary)]"
              checked={skipOnchain}
              disabled={localBusy || phase !== "confirm"}
              onChange={(event) => {
                setSkipOnchain(event.target.checked);
                setLocalError(null);
              }}
            />
            <span className="text-muted-foreground text-[0.85rem] leading-snug">
              {copy.skipOnchainLabel}
            </span>
          </label>
          {skipOnchain ? (
            <p className="text-destructive m-0 mt-2 text-[0.85rem] leading-snug">
              {copy.skipOnchainAcknowledgement}
            </p>
          ) : null}
          {localError ? (
            <p className="text-destructive m-0 mt-2 text-[0.85rem]" role="alert">
              {localError}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
