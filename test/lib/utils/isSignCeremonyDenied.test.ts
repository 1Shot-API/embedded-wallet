import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OwsNotAllowedError, OwsSignDeniedError } from "@1shotapi/ows-types";
import {
  isSignCeremonyDenied,
  shouldHideDisplayOnRelayerError,
} from "@/lib/utils/isSignCeremonyDenied.ts";

describe("isSignCeremonyDenied", () => {
  it("recognizes OwsSignDeniedError", () => {
    assert.equal(
      isSignCeremonyDenied(new OwsSignDeniedError("signDenied")),
      true,
    );
  });

  it("recognizes OwsNotAllowedError", () => {
    assert.equal(
      isSignCeremonyDenied(new OwsNotAllowedError("NotAllowed")),
      true,
    );
  });

  it("recognizes ceremonyCancelled message", () => {
    assert.equal(
      isSignCeremonyDenied(new Error("ceremonyCancelled")),
      true,
    );
  });

  it("rejects unrelated errors", () => {
    assert.equal(
      isSignCeremonyDenied(new Error("relayer_estimate7710Transaction failed")),
      false,
    );
  });
});

describe("shouldHideDisplayOnRelayerError", () => {
  it("never hides when retainDisplayDuringSubmit is true", () => {
    assert.equal(
      shouldHideDisplayOnRelayerError(new Error("fail"), true),
      false,
    );
  });

  it("does not hide on signer cancel for host sends", () => {
    assert.equal(
      shouldHideDisplayOnRelayerError(
        new OwsSignDeniedError("signDenied"),
        false,
      ),
      false,
    );
    assert.equal(
      shouldHideDisplayOnRelayerError(
        new OwsNotAllowedError("NotAllowed"),
        false,
      ),
      false,
    );
  });

  it("hides on terminal errors for host sends", () => {
    assert.equal(
      shouldHideDisplayOnRelayerError(
        new Error("estimate failed"),
        false,
      ),
      true,
    );
  });
});
