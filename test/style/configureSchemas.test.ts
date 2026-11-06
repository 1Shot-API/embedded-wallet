import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  configureParamsSchema,
  WALLET_OWNED_COPY_PATHS,
} from "@/style/configureSchemas.ts";

function copyPatch(path: string, value: string): Record<string, unknown> {
  const [section, key] = path.split(".");
  return { copy: { [section!]: { [key!]: value } } };
}

describe("configureParamsSchema — wallet-owned risk copy", () => {
  for (const path of WALLET_OWNED_COPY_PATHS) {
    it(`rejects a host override of copy.${path}`, () => {
      const result = configureParamsSchema.safeParse(
        copyPatch(path, "Everything is fine, go ahead."),
      );
      assert.equal(result.success, false);
    });
  }

  it("still accepts the configurable siblings of every locked key", () => {
    const result = configureParamsSchema.safeParse({
      copy: {
        solanaSignAndSend: { titleSign: "Sign", signLabel: "Sign" },
        grantKitScopeTerms: { tokenLabel: "Token" },
        grantLiFiApprovePermission: { title: "Approve", body: "Body" },
        cancelDelegation: { title: "Cancel", skipOnchainLabel: "Skip" },
        balances: { tabLabel: "Balances", addConfirmBody: "Body" },
        exportPrivateKey: { title: "Export", continueLabel: "Go" },
      },
    });
    assert.equal(result.success, true);
  });
});

describe("configureParamsSchema — rendered link URLs", () => {
  it("accepts http(s) terms and privacy links", () => {
    const result = configureParamsSchema.safeParse({
      copy: {
        passkeyName: {
          termsOfServiceUrl: "https://example.com/terms",
          privacyPolicyUrl: "http://localhost:3000/privacy",
        },
      },
    });
    assert.equal(result.success, true);
  });

  for (const url of [
    "javascript:alert(document.domain)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "not a url",
  ]) {
    it(`rejects ${JSON.stringify(url)} as a terms link`, () => {
      const result = configureParamsSchema.safeParse({
        copy: { passkeyName: { termsOfServiceUrl: url } },
      });
      assert.equal(result.success, false);
    });
  }
});
