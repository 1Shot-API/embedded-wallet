import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ANALYTICS_ERROR_CODE_MAX_LENGTH,
  analyticsErrorCode,
} from "@/lib/implementations/utils/runWithAnalytics.ts";

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe("analyticsErrorCode", () => {
  it("includes the actual message, not just the error name", () => {
    const code = analyticsErrorCode(
      namedError(
        "OwsInvalidRequestError",
        "Passkey does not support PRF or PRF output missing",
      ),
    );
    assert.equal(
      code,
      "OwsInvalidRequestError: Passkey does not support PRF or PRF output missing",
    );
  });

  it("keeps WebAuthn NotAllowed detail", () => {
    const code = analyticsErrorCode(
      namedError(
        "OwsNotAllowedError",
        "The operation either timed out or was not allowed",
      ),
    );
    assert.ok(code.startsWith("OwsNotAllowedError: The operation"));
  });

  it("falls back to signer reason when message is empty", () => {
    const error = namedError("OwsInvalidRequestError", "");
    (error as unknown as { reason: string }).reason = "invalidName";
    assert.equal(analyticsErrorCode(error), "OwsInvalidRequestError: invalidName");
  });

  it("handles DOMException-shaped objects", () => {
    assert.equal(
      analyticsErrorCode({ name: "NotAllowedError", message: "blocked" }),
      "NotAllowedError: blocked",
    );
  });

  it("preserves well over 64 chars of a long message", () => {
    const message = "x".repeat(200);
    const code = analyticsErrorCode(namedError("SomeError", message));
    assert.ok(code.length > 64);
    assert.equal(code, `SomeError: ${message}`);
  });

  it("truncates at the max length", () => {
    const code = analyticsErrorCode(
      namedError("SomeError", "y".repeat(500)),
    );
    assert.equal(code.length, ANALYTICS_ERROR_CODE_MAX_LENGTH);
  });

  it("returns Unknown for empty errors", () => {
    assert.equal(analyticsErrorCode(new Error("")), "Unknown");
    assert.equal(analyticsErrorCode(null), "Unknown");
  });
});
