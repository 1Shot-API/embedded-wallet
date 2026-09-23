import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mock, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import type { IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { StyleProvider } from "@/style/StyleProvider.tsx";
import {
  ERC20_TRANSFER_AMOUNT,
  FUNCTION_CALL,
  OWNERSHIP_TRANSFER,
} from "@/lib/interfaces/business/IDelegationService.ts";

const walletProvider = pathToFileURL(
  path.resolve("src/wallet/WalletProvider.tsx"),
).href;

await mock.module(walletProvider, {
  namedExports: {
    useWallet: () => ({
      listTrackedAssets: async () => [],
      getKnownAsset: async () => null,
      liFiUtils: { defaultSlippageBps: 50 },
    }),
    WalletProvider: ({ children }: { children: React.ReactNode }) => children,
  },
});

const {
  Erc20TransferPermissionTerms,
  isErc20TransferPermissionValid,
} = await import(
  "@/components/modals/permissionGrantTerms/erc20TransferTerms.tsx"
);
const {
  FunctionCallPermissionTerms,
  isFunctionCallPermissionValid,
} = await import(
  "@/components/modals/permissionGrantTerms/functionCallTerms.tsx"
);
const {
  OwnershipTransferPermissionTerms,
  isOwnershipTransferPermissionValid,
} = await import(
  "@/components/modals/permissionGrantTerms/ownershipTransferTerms.tsx"
);
const token = "0x" + "a".repeat(40);
const target = "0x" + "b".repeat(40);
const contract = "0x" + "c".repeat(40);

function wrapTerms(node: React.ReactNode): string {
  return renderToStaticMarkup(
    <StyleProvider>{node}</StyleProvider>,
  );
}

function baseRequest(
  permission: IExecutionPermissionRequest["permission"],
): IExecutionPermissionRequest {
  return {
    chainId: "0x2105",
    permission,
    caveats: [],
  };
}

describe("kit scope permission terms", () => {
  it("Erc20TransferPermissionTerms renders token symbol and max amount rows", () => {
    const html = wrapTerms(
      <Erc20TransferPermissionTerms
        executionRequest={baseRequest({
          type: ERC20_TRANSFER_AMOUNT,
          isAdjustmentAllowed: false,
          data: { tokenAddress: token, maxAmount: "1000000" },
        })}
      />,
    );
    assert.ok(html.includes("Token"));
    assert.ok(html.includes("Max Amount"));
    assert.ok(html.includes("TOKEN"));
  });

  it("OwnershipTransferPermissionTerms renders ownershipWarning copy", () => {
    const html = wrapTerms(
      <OwnershipTransferPermissionTerms
        executionRequest={baseRequest({
          type: OWNERSHIP_TRANSFER,
          isAdjustmentAllowed: false,
          data: { contractAddress: contract },
        })}
      />,
    );
    assert.ok(
      html.includes(
        "This permission can transfer ownership of a smart contract",
      ),
    );
    assert.ok(html.includes("Contract"));
  });

  it("FunctionCallPermissionTerms renders targets, selectors, max value, pinned parameters", () => {
    const html = wrapTerms(
      <FunctionCallPermissionTerms
        executionRequest={baseRequest({
          type: FUNCTION_CALL,
          isAdjustmentAllowed: false,
          data: {
            targets: [target],
            selectors: ["0x12345678"],
            maxValue: "1000000000000000000",
            allowedCalldata: [{ startIndex: 4, value: "0xdeadbeef" }],
          },
        })}
      />,
    );
    assert.ok(html.includes("Allowed Contracts"));
    assert.ok(html.includes("Allowed Functions"));
    assert.ok(html.includes("0x12345678"));
    assert.ok(html.includes("Max Value"));
    assert.ok(html.includes("Pinned Parameters"));
    assert.ok(html.includes("@4: 0xdeadbeef"));
  });
});

describe("kit scope permission validation", () => {
  it("isErc20TransferPermissionValid accepts valid payload", () => {
    assert.equal(
      isErc20TransferPermissionValid(
        baseRequest({
          type: ERC20_TRANSFER_AMOUNT,
          isAdjustmentAllowed: false,
          data: { tokenAddress: token, maxAmount: "1" },
        }),
      ),
      true,
    );
  });

  it("isErc20TransferPermissionValid rejects missing token", () => {
    assert.equal(
      isErc20TransferPermissionValid(
        baseRequest({
          type: ERC20_TRANSFER_AMOUNT,
          isAdjustmentAllowed: false,
          data: { maxAmount: "1" },
        }),
      ),
      false,
    );
  });

  it("isOwnershipTransferPermissionValid accepts contract-only payload", () => {
    assert.equal(
      isOwnershipTransferPermissionValid(
        baseRequest({
          type: OWNERSHIP_TRANSFER,
          isAdjustmentAllowed: false,
          data: { contractAddress: contract },
        }),
      ),
      true,
    );
  });

  it("isOwnershipTransferPermissionValid rejects empty data", () => {
    assert.equal(
      isOwnershipTransferPermissionValid(
        baseRequest({
          type: OWNERSHIP_TRANSFER,
          isAdjustmentAllowed: false,
          data: {},
        }),
      ),
      false,
    );
  });

  it("isFunctionCallPermissionValid accepts valid function-call payload", () => {
    assert.equal(
      isFunctionCallPermissionValid(
        baseRequest({
          type: FUNCTION_CALL,
          isAdjustmentAllowed: false,
          data: {
            targets: [target],
            selectors: ["0x12345678"],
            maxValue: "0",
          },
        }),
      ),
      true,
    );
  });

  it("isFunctionCallPermissionValid rejects empty selectors", () => {
    assert.equal(
      isFunctionCallPermissionValid(
        baseRequest({
          type: FUNCTION_CALL,
          isAdjustmentAllowed: false,
          data: {
            targets: [target],
            selectors: [],
            maxValue: "0",
          },
        }),
      ),
      false,
    );
  });
});
