import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendCreateHostQuery,
  CREATE_HOST_QUERY_KEY,
  CREATE_HOST_QUERY_VALUE,
  isCreateHostSearchParams,
  resolveCreateHostEmbed,
} from "@/wallet/createHostEmbed.ts";

describe("appendCreateHostQuery", () => {
  it("sets createHost=1 on the URL", () => {
    const url = new URL("https://wallet.example/");
    appendCreateHostQuery(url);
    assert.equal(
      url.searchParams.get(CREATE_HOST_QUERY_KEY),
      CREATE_HOST_QUERY_VALUE,
    );
  });
});

describe("isCreateHostSearchParams", () => {
  it("returns true when createHost=1", () => {
    assert.equal(
      isCreateHostSearchParams(new URLSearchParams("createHost=1")),
      true,
    );
  });

  it("returns false when the param is absent", () => {
    assert.equal(isCreateHostSearchParams(new URLSearchParams("")), false);
  });

  it("returns false when the param has the wrong value", () => {
    assert.equal(
      isCreateHostSearchParams(new URLSearchParams("createHost=0")),
      false,
    );
  });
});

describe("resolveCreateHostEmbed", () => {
  const createHostParams = new URLSearchParams("createHost=1");

  it("requires embedded + createHost=1", () => {
    assert.equal(
      resolveCreateHostEmbed({
        embedded: true,
        searchParams: createHostParams,
      }),
      true,
    );
  });

  it("returns false when not embedded", () => {
    assert.equal(
      resolveCreateHostEmbed({
        embedded: false,
        searchParams: createHostParams,
      }),
      false,
    );
  });

  it("returns false when query flag is missing", () => {
    assert.equal(
      resolveCreateHostEmbed({
        embedded: true,
        searchParams: new URLSearchParams(""),
      }),
      false,
    );
  });
});
