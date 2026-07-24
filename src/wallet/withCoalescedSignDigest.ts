import type { CeremonyUiParams, DigestSignedData } from "@1shotapi/ows-types";
import type { OWSSigner } from "@1shotapi/ows-signer-utils";

type SignDigestFn = OWSSigner["signDigest"];
type Digests = Parameters<SignDigestFn>[0];

type IPendingBatch = {
  digests: Digests;
  resolve: (value: DigestSignedData[]) => void;
  reject: (reason: unknown) => void;
};

/**
 * Coalesce concurrent `signDigest` calls (same microtask turn) into one
 * Signing Layer ceremony. Use with `Promise.all` of MetaMask/viem sign paths
 * so EIP-7702 + fee/work delegations share a single passkey.
 */
export async function withCoalescedSignDigest<T>(
  signer: OWSSigner,
  ceremony: CeremonyUiParams,
  run: () => Promise<T>,
): Promise<T> {
  const original = signer.signDigest.bind(signer) as SignDigestFn;
  let pending: IPendingBatch[] = [];
  let flushScheduled = false;

  const flush = (): void => {
    const batch = pending;
    pending = [];
    flushScheduled = false;
    if (batch.length === 0) return;

    const allDigests = batch.flatMap((item) => item.digests);
    void original(allDigests, ceremony).then(
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

  signer.signDigest = ((digests: Digests) => {
    return new Promise<DigestSignedData[]>((resolve, reject) => {
      pending.push({ digests, resolve, reject });
      if (!flushScheduled) {
        flushScheduled = true;
        queueMicrotask(flush);
      }
    });
  }) as SignDigestFn;

  try {
    return await run();
  } finally {
    signer.signDigest = original;
    if (pending.length > 0) {
      flush();
    }
  }
}
