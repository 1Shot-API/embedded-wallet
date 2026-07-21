import type {
  EVMAccountAddress,
  EVMChainId,
  HexString,
} from "@1shotapi/ows-types";

export interface IDecodedErc20Transfer {
  tokenAddress: EVMAccountAddress;
  recipient: EVMAccountAddress;
  amount: bigint;
}

export interface ITransactionUtils {
  /** Decode ERC-20 `transfer(address,uint256)` when calldata matches. */
  tryDecodeErc20Transfer(
    to: EVMAccountAddress | null,
    data: HexString,
  ): IDecodedErc20Transfer | null;

  formatTokenAmount(
    amount: bigint,
    decimals: number | null | undefined,
  ): string;

  /** Best-effort host domain for consent copy (`ancestorOrigins` / referrer). */
  resolveHostDomain(): string;

  chainLabelFor(
    chainId: EVMChainId,
    chains: ReadonlyArray<{ chainId: EVMChainId; label: string }>,
  ): string;
}

export const ITransactionUtilsType = Symbol.for("ITransactionUtils");
