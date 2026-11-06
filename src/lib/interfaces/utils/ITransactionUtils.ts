import type {
  DomainString,
  EVMAccountAddress,
  EVMContractAddress,
  HexString,
  OWSChainId,
} from "@1shotapi/ows-types";

export interface IDecodedErc20Transfer {
  tokenAddress: EVMContractAddress;
  recipient: EVMAccountAddress;
  amount: bigint;
}

export interface ITransactionUtils {
  /** Decode ERC-20 `transfer(address,uint256)` when calldata matches. */
  tryDecodeErc20Transfer(
    to: EVMContractAddress | null,
    data: HexString,
  ): IDecodedErc20Transfer | null;

  formatTokenAmount(
    amount: bigint,
    decimals: number | null | undefined,
  ): string;

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
