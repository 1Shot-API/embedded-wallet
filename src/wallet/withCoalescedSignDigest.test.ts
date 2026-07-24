import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CeremonyUiParams, DigestSignedData } from "@1shotapi/ows-types";
import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import { withCoalescedSignDigest } from "./withCoalescedSignDigest.ts";

describe("withCoalescedSignDigest", () => {
  it("merges concurrent signDigest calls into one ceremony", async () => {
    let callCount = 0;
    const signer = {
      async signDigest(digests: Array<{ digestData: string }>) {
        callCount += 1;
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

    const ceremony: CeremonyUiParams = {
      explanationHeader: "Approve transaction",
      explanationText: "test",
    };

    const [a, b, c] = await withCoalescedSignDigest(signer, ceremony, () =>
      Promise.all([
        signer.signDigest([{ digestData: "0x01" as `0x${string}` }]),
        signer.signDigest([{ digestData: "0x02" as `0x${string}` }]),
        signer.signDigest([{ digestData: "0x03" as `0x${string}` }]),
      ]),
    );

    assert.equal(callCount, 1);
    assert.equal(a?.[0]?.digest, "0x01");
    assert.equal(b?.[0]?.digest, "0x02");
    assert.equal(c?.[0]?.digest, "0x03");
  });
});
