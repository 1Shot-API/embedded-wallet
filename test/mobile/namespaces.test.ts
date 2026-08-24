import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildApprovedNamespaces,
  caip10Account,
  EIP155_EVENTS,
  EIP155_METHODS,
  NamespaceApprovalError,
} from "../../mobile/namespaces.ts";

const ADDRESS = "0x0000000000000000000000000000000000000001";

describe("buildApprovedNamespaces", () => {
  it("approves the intersection of optional eip155 chains with the catalog", () => {
    const approved = buildApprovedNamespaces({
      optionalNamespaces: {
        eip155: {
          chains: ["eip155:1", "eip155:8453", "eip155:999999"],
          methods: ["eth_sendTransaction", "personal_sign"],
          events: ["chainChanged"],
        },
      },
      address: ADDRESS,
    });

    assert.deepEqual(approved.eip155.chains.sort(), ["eip155:1", "eip155:8453"]);
    assert.deepEqual(
      approved.eip155.accounts.sort(),
      [
        caip10Account(1, ADDRESS),
        caip10Account(8453, ADDRESS),
      ].sort(),
    );
    assert.deepEqual(
      [...approved.eip155.methods].sort(),
      ["eth_sendTransaction", "personal_sign"].sort(),
    );
    assert.deepEqual(approved.eip155.events, ["chainChanged"]);
  });

  it("rejects unsupported required chains instead of dropping them", () => {
    assert.throws(
      () =>
        buildApprovedNamespaces({
          requiredNamespaces: {
            eip155: {
              chains: ["eip155:1", "eip155:999999"],
              methods: ["eth_sendTransaction"],
              events: ["chainChanged"],
            },
          },
          address: ADDRESS,
        }),
      (error: unknown) =>
        error instanceof NamespaceApprovalError &&
        error.sdkError === "UNSUPPORTED_CHAINS",
    );
  });

  it("rejects required non-eip155 namespaces", () => {
    assert.throws(
      () =>
        buildApprovedNamespaces({
          requiredNamespaces: {
            solana: {
              chains: ["solana:mainnet"],
              methods: ["solana_signTransaction"],
              events: [],
            },
          },
          optionalNamespaces: {
            eip155: { chains: ["eip155:1"] },
          },
          address: ADDRESS,
        }),
      (error: unknown) =>
        error instanceof NamespaceApprovalError &&
        error.sdkError === "UNSUPPORTED_NAMESPACE_KEY",
    );
  });

  it("does not copy methods from optional non-eip155 namespaces into eip155", () => {
    const approved = buildApprovedNamespaces({
      optionalNamespaces: {
        eip155: {
          chains: ["eip155:1"],
          methods: ["personal_sign"],
          events: ["accountsChanged"],
        },
        solana: {
          chains: ["solana:mainnet"],
          methods: ["solana_signTransaction"],
          events: ["connect"],
        },
      },
      address: ADDRESS,
    });

    assert.deepEqual(approved.eip155.chains, ["eip155:1"]);
    assert.deepEqual(approved.eip155.methods, ["personal_sign"]);
    assert.ok(!approved.eip155.methods.includes("solana_signTransaction"));
    assert.ok(!approved.eip155.events.includes("connect"));
    assert.equal(Object.keys(approved).join(","), "eip155");
  });

  it("does not fall back to every catalog chain when nothing matches", () => {
    assert.throws(
      () =>
        buildApprovedNamespaces({
          optionalNamespaces: {
            eip155: {
              chains: ["eip155:999999"],
              methods: ["personal_sign"],
            },
          },
          address: ADDRESS,
        }),
      (error: unknown) =>
        error instanceof NamespaceApprovalError &&
        error.sdkError === "UNSUPPORTED_CHAINS",
    );
  });

  it("rejects required methods this host cannot serve", () => {
    assert.throws(
      () =>
        buildApprovedNamespaces({
          requiredNamespaces: {
            eip155: {
              chains: ["eip155:1"],
              methods: ["eth_sendTransaction", "wallet_watchAsset"],
              events: ["chainChanged"],
            },
          },
          address: ADDRESS,
        }),
      (error: unknown) =>
        error instanceof NamespaceApprovalError &&
        error.sdkError === "UNSUPPORTED_METHODS",
    );
  });

  it("unions required eip155 with supported optional eip155 chains", () => {
    const approved = buildApprovedNamespaces({
      requiredNamespaces: {
        eip155: {
          chains: ["eip155:1"],
          methods: ["eth_sendTransaction"],
          events: ["chainChanged"],
        },
      },
      optionalNamespaces: {
        eip155: {
          chains: ["eip155:8453", "eip155:999999"],
          methods: ["personal_sign", "wallet_watchAsset"],
          events: ["accountsChanged", "disconnect"],
        },
      },
      address: ADDRESS,
    });

    assert.deepEqual(approved.eip155.chains.sort(), ["eip155:1", "eip155:8453"]);
    assert.deepEqual(
      [...approved.eip155.methods].sort(),
      ["eth_sendTransaction", "personal_sign"].sort(),
    );
    assert.deepEqual(
      [...approved.eip155.events].sort(),
      ["accountsChanged", "chainChanged"].sort(),
    );
    assert.ok(!approved.eip155.methods.includes("wallet_watchAsset"));
  });

  it("defaults to host methods when the proposal lists no eip155 methods", () => {
    const approved = buildApprovedNamespaces({
      optionalNamespaces: {
        eip155: { chains: ["eip155:1"] },
      },
      address: ADDRESS,
    });
    assert.deepEqual(
      [...approved.eip155.methods].sort(),
      [...EIP155_METHODS].sort(),
    );
    assert.deepEqual(
      [...approved.eip155.events].sort(),
      [...EIP155_EVENTS].sort(),
    );
  });
});
