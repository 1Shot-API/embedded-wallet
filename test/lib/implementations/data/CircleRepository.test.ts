import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFeeRow } from "@/lib/implementations/data/CircleRepository.ts";

describe("CircleRepository Iris fee parsing", () => {
  it("accepts numeric forwardFee atoms from Iris sandbox", () => {
    const fee = parseFeeRow({
      finalityThreshold: 1000,
      minimumFee: 0,
      forwardFee: { low: 53982, med: 53982, high: 54294 },
    });
    assert.ok(fee);
    assert.equal(fee.finalityThreshold, 1000);
    assert.equal(fee.minimumFee, 0);
    assert.equal(fee.forwardFee.med, "53982");
    assert.equal(fee.forwardFee.low, "53982");
    assert.equal(fee.forwardFee.high, "54294");
  });

  it("accepts string forwardFee atoms", () => {
    const fee = parseFeeRow({
      finalityThreshold: 2000,
      minimumFee: 0.001,
      forwardFee: { low: "100", med: "200", high: "300" },
    });
    assert.ok(fee);
    assert.equal(fee.forwardFee.med, "200");
  });

  it("returns null when med is missing", () => {
    assert.equal(
      parseFeeRow({
        finalityThreshold: 1000,
        minimumFee: 0,
        forwardFee: { low: 1, high: 2 },
      }),
      null,
    );
  });
});
