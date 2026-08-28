import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EVMAccountAddress,
  EVMTransactionHash,
} from "@1shotapi/ows-types";
import { EChain } from "@/lib/types/enum/EChain.ts";
import { ECircleDomainId } from "@/lib/types/enum/ECircleDomainId.ts";
import {
  parseInFlight,
  serializeInFlight,
} from "@/lib/implementations/data/CircleRepository.ts";
import type { ICctpInFlightBurn } from "@/lib/interfaces/data/ICircleRepository.ts";

describe("CCTP in-flight persist/resume", () => {
  const record: ICctpInFlightBurn = {
    burnTxHash: EVMTransactionHash(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ),
    sourceDomain: ECircleDomainId.Base,
    sourceChainId: EChain.Base,
    destChainId: EChain.Ethereum,
    amountAtoms: 10_000_000n,
    address: EVMAccountAddress("0x1111111111111111111111111111111111111111"),
  };

  it("round-trips burn hash, domains, and amount atoms", () => {
    const restored = parseInFlight(serializeInFlight(record));
    assert.ok(restored);
    assert.equal(restored.burnTxHash, record.burnTxHash);
    assert.equal(restored.sourceDomain, ECircleDomainId.Base);
    assert.equal(restored.sourceChainId, EChain.Base);
    assert.equal(restored.destChainId, EChain.Ethereum);
    assert.equal(restored.amountAtoms, 10_000_000n);
    assert.equal(String(restored.address).toLowerCase(), String(record.address));
  });

  it("returns null for malformed JSON", () => {
    assert.equal(parseInFlight("{"), null);
    assert.equal(parseInFlight("{}"), null);
    assert.equal(parseInFlight(JSON.stringify({ burnTxHash: "nope" })), null);
  });
});
