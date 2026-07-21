import {
  decodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  type Hex,
} from "viem";
import {
  EVMAccountAddress,
  type EVMChainId,
  type HexString,
} from "@1shotapi/ows-types";
import type {
  IDecodedErc20Transfer,
  ITransactionUtils,
} from "../../interfaces/utils/ITransactionUtils";

/** EVM transfer helpers (decode, amount formatting, host/chain labels). */
export class TransactionUtils implements ITransactionUtils {
  tryDecodeErc20Transfer(
    to: EVMAccountAddress | null,
    data: HexString,
  ): IDecodedErc20Transfer | null {
    if (!to || !data || String(data) === "0x" || data.length < 10) {
      return null;
    }
    try {
      const decoded = decodeFunctionData({
        abi: erc20Abi,
        data: data as Hex,
      });
      if (decoded.functionName !== "transfer") {
        return null;
      }
      const [recipient, amount] = decoded.args as readonly [
        `0x${string}`,
        bigint,
      ];
      return {
        tokenAddress: to,
        recipient: EVMAccountAddress(getAddress(recipient)),
        amount,
      };
    } catch {
      return null;
    }
  }

  formatTokenAmount(
    amount: bigint,
    decimals: number | null | undefined,
  ): string {
    if (decimals === null || decimals === undefined) {
      return amount.toString();
    }
    try {
      return formatUnits(amount, decimals);
    } catch {
      return amount.toString();
    }
  }

  resolveHostDomain(): string {
    try {
      const ancestorOrigins = (
        location as Location & { ancestorOrigins?: DOMStringList }
      ).ancestorOrigins;
      if (ancestorOrigins && ancestorOrigins.length > 0) {
        return new URL(ancestorOrigins[0]!).hostname;
      }
    } catch {
      // fall through
    }
    try {
      if (document.referrer) {
        return new URL(document.referrer).hostname;
      }
    } catch {
      // fall through
    }
    return "the connected app";
  }

  chainLabelFor(
    chainId: EVMChainId,
    chains: ReadonlyArray<{ chainId: EVMChainId; label: string }>,
  ): string {
    return chains.find((chain) => chain.chainId === chainId)?.label ?? chainId;
  }
}
