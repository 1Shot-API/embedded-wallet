import type {
  CeremonyUiParams,
  DigestSignedData,
  ExecuteBatchParams,
  WebAuthnAssertionFields,
} from "@1shotapi/ows-types";
import type { OWSSigner } from "@1shotapi/ows-signer-utils";

type SignDigestFn = OWSSigner["signDigest"];
type Digests = Parameters<SignDigestFn>[0];

type IPendingBatch = {
  digests: Digests;
  resolve: (value: DigestSignedData[]) => void;
  reject: (reason: unknown) => void;
};

export type CoalesceSignDigestOptions = {
  /**
   * Flush as soon as this many `signDigest` calls are queued (e.g. 2 for
   * fee+work, 3 with EIP-7702). Falls back to a short debounce so a failed
   * branch cannot hang forever.
   */
  minCalls?: number;
  /**
   * When set, the coalesced flush uses `executeBatch({ digests, challenge })`
   * so TX signatures and relayer WebAuthn auth share one passkey ceremony.
   */
  challenge?: `0x${string}`;
  /** Called with the batch assertion when {@link challenge} is set. */
  onBatchAssertion?: (assertion: WebAuthnAssertionFields) => void;
};

/**
 * Coalesce concurrent `signDigest` calls into one Signing Layer ceremony.
 *
 * The Signing Layer cancels any open Confirm UI when a new RPC arrives
 * (`ceremonyCancelled`). Parallel MetaMask/viem paths often reach `signDigest`
 * on different turns, so a single `queueMicrotask` flush is not enough.
 *
 * Strategy:
 * - Prefer flushing once `minCalls` invocations are queued.
 * - Otherwise debounce with `setTimeout(0)` so same-turn resumes still merge.
 * - Never overlap signer RPCs — queue a follow-up flush instead of posting a
 *   second request that would abort the first.
 * - Optional {@link CoalesceSignDigestOptions.challenge} routes the flush
 *   through `executeBatch` for mixed sign + relayer auth.
 */
export async function withCoalescedSignDigest<T>(
  signer: OWSSigner,
  ceremony: CeremonyUiParams,
  run: () => Promise<T>,
  options?: CoalesceSignDigestOptions,
): Promise<T> {
  const minCalls = Math.max(1, options?.minCalls ?? 1);
  const original = signer.signDigest.bind(signer) as SignDigestFn;
  const originalExecuteBatch = options?.challenge
    ? signer.executeBatch.bind(signer)
    : null;
  let pending: IPendingBatch[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let flushChain: Promise<void> = Promise.resolve();

  const flushNow = (): Promise<void> => {
    const batch = pending;
    pending = [];
    if (batch.length === 0) return Promise.resolve();

    const allDigests = batch.flatMap((item) => item.digests);

    if (options?.challenge) {
      if (!originalExecuteBatch) {
        throw new Error("withCoalescedSignDigest: challenge requires executeBatch");
      }
      return originalExecuteBatch({
        ...ceremony,
        digests: allDigests as ExecuteBatchParams["digests"],
        challenge: options.challenge,
      }).then(
        (batchResult) => {
          if (batchResult.assertion) {
            options.onBatchAssertion?.(batchResult.assertion);
          }
          const results = batchResult.results ?? [];
          let offset = 0;
          for (const item of batch) {
            const count = item.digests.length;
            item.resolve(results.slice(offset, offset + count));
            offset += count;
          }
        },
        (error: unknown) => {
          for (const item of batch) {
            item.reject(error);
          }
        },
      );
    }

    return original(allDigests, ceremony).then(
      (results) => {
        let offset = 0;
        for (const item of batch) {
          const count = item.digests.length;
          item.resolve(results.slice(offset, offset + count));
          offset += count;
        }
      },
      (error: unknown) => {
        for (const item of batch) {
          item.reject(error);
        }
      },
    );
  };

  const enqueueFlush = (): void => {
    flushChain = flushChain.then(() => flushNow());
  };

  const scheduleFlush = (): void => {
    if (pending.length >= minCalls) {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      enqueueFlush();
      return;
    }

    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    // minCalls===1: merge same-turn resumes. minCalls>1: safety net if a
    // branch never reaches signDigest (avoids deadlock); prefer hitting
    // minCalls before this fires.
    const delayMs = minCalls > 1 ? 50 : 0;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      enqueueFlush();
    }, delayMs);
  };

  signer.signDigest = ((digests: Digests) => {
    return new Promise<DigestSignedData[]>((resolve, reject) => {
      pending.push({ digests, resolve, reject });
      scheduleFlush();
    });
  }) as SignDigestFn;

  try {
    return await run();
  } finally {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    // Always drain leftovers (minCalls>1 held digests, or debounce not fired).
    if (pending.length > 0) {
      enqueueFlush();
    }
    signer.signDigest = original;
    await flushChain;
  }
}
