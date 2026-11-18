import type {
  DomainString,
  EVMAccountAddress,
  EVMContractAddress,
  HexString,
  OWSChainId,
} from "@1shotapi/ows-types";

export type IDecodedErc20Call =
  | {
      kind: "transfer";
      tokenAddress: EVMContractAddress;
      recipient: EVMAccountAddress;
      amount: bigint;
    }
  | {
      kind: "approve";
      tokenAddress: EVMContractAddress;
      spender: EVMAccountAddress;
      amount: bigint;
    };

export interface ITransactionUtils {
  /**
   * Decode ERC-20 `transfer(address,uint256)` or `approve(address,uint256)`.
   * Any other selector returns null.
   */
  tryDecodeErc20(
    to: EVMContractAddress | null,
    data: HexString,
  ): IDecodedErc20Call | null;

  formatTokenAmount(
    amount: bigint,
    decimals: number | null | undefined,
  ): string;

  /**
   * Approval amount for the token card. Values at or above 2^255 are "Unlimited".
   */
  formatErc20ApproveAmount(amount: bigint, decimals: number): string;

  /**
   * Hostname of the embedding Host page, from the browser-attested handshake
   * origin (see `IHostOriginProvider`). `unknown` until a host has connected.
   */
  resolveHostDomain(): DomainString;

  chainLabelFor(
    chainId: OWSChainId,
    chains: ReadonlyArray<{
      chainId: OWSChainId;
      label: string;
    }>,
  ): string;
}

export const ITransactionUtilsType = Symbol.for("ITransactionUtils");
