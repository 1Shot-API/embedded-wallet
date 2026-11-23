import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isEmptyCalldata } from "@/lib/utils/emptyCalldata.ts";

describe("isEmptyCalldata", () => {
  it("is true without a 4-byte selector", () => {
    assert.equal(isEmptyCalldata(null), true);
    assert.equal(isEmptyCalldata(""), true);
    assert.equal(isEmptyCalldata("0x"), true);
    assert.equal(isEmptyCalldata("0X00"), true);
  });

  it("is false once four bytes are present", () => {
    assert.equal(isEmptyCalldata("0x00000000"), false);
    assert.equal(isEmptyCalldata("0xa9059cbb0000"), false);
  });
});
