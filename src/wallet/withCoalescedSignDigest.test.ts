import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CeremonyUiParams, DigestSignedData } from "@1shotapi/ows-types";
import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import { withCoalescedSignDigest } from "./withCoalescedSignDigest.ts";

function mockSigner(onCall?: (digests: Array<{ digestData: string }>) => void) {
  let callCount = 0;
  const signer = {
    async signDigest(digests: Array<{ digestData: string }>) {
      callCount += 1;
      onCall?.(digests);
      return digests.map(
        (d, i): DigestSignedData => ({
          digest: d.digestData as `0x${string}`,
          signature: `0x${String(i).padStart(130, "0")}` as `0x${string}`,
          scheme: "secp256k1-ecdsa-recoverable",
          credentialId: null,
        }),
      );
    },
  } as unknown as OWSSigner;
  return {
    signer,
    get callCount() {
      return callCount;
    },
  };
}

const ceremony: CeremonyUiParams = {
  explanationHeader: "Approve transaction",
  explanationText: "test",
};

describe("withCoalescedSignDigest", () => {
  it("merges concurrent signDigest calls into one ceremony", async () => {
    const mock = mockSigner();

    const [a, b, c] = await withCoalescedSignDigest(mock.signer, ceremony, () =>
      Promise.all([
        mock.signer.signDigest([{ digestData: "0x01" as `0x${string}` }]),
        mock.signer.signDigest([{ digestData: "0x02" as `0x${string}` }]),
        mock.signer.signDigest([{ digestData: "0x03" as `0x${string}` }]),
      ]),
      { minCalls: 3 },
    );

    assert.equal(mock.callCount, 1);
    assert.equal(a?.[0]?.digest, "0x01");
    assert.equal(b?.[0]?.digest, "0x02");
    assert.equal(c?.[0]?.digest, "0x03");
  });

  it("merges signDigest calls staggered across macrotasks when minCalls is set", async () => {
    const mock = mockSigner();

    const [a, b] = await withCoalescedSignDigest(
      mock.signer,
      ceremony,
      async () => {
        const first = mock.signer.signDigest([
          { digestData: "0x01" as `0x${string}` },
        ]);
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 5);
        });
        const second = mock.signer.signDigest([
          { digestData: "0x02" as `0x${string}` },
        ]);
        return Promise.all([first, second]);
      },
      { minCalls: 2 },
    );

    assert.equal(mock.callCount, 1);
    assert.equal(a?.[0]?.digest, "0x01");
    assert.equal(b?.[0]?.digest, "0x02");
  });

  it("does not start a second overlapping ceremony while the first is in flight", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const signer = {
      async signDigest(digests: Array<{ digestData: string }>) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 20);
        });
        inFlight -= 1;
        return digests.map(
          (d, i): DigestSignedData => ({
            digest: d.digestData as `0x${string}`,
            signature: `0x${String(i).padStart(130, "0")}` as `0x${string}`,
            scheme: "secp256k1-ecdsa-recoverable",
            credentialId: null,
          }),
        );
      },
    } as unknown as OWSSigner;

    await withCoalescedSignDigest(signer, ceremony, async () => {
      const first = signer.signDigest([
        { digestData: "0x01" as `0x${string}` },
      ]);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 5);
      });
      // Debounce already fired for the first call; this must queue, not overlap.
      const second = signer.signDigest([
        { digestData: "0x02" as `0x${string}` },
      ]);
      return Promise.all([first, second]);
    });

    assert.equal(maxInFlight, 1);
  });
});
