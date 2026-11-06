import {
  DomainString,
  type EVMContractAddress,
  EVMAccountAddress,
  type EVMChainId,
  type HexString,
} from "@1shotapi/ows-types";
import {
  decodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  type Hex,
} from "viem";

import type { IHostOriginProvider } from "../../interfaces/utils/IHostOriginProvider";
import type {
  IDecodedErc20Transfer,
  ITransactionUtils,
} from "../../interfaces/utils/ITransactionUtils";

/** Used in consent copy and stored on grants before any host has connected. */
const UNKNOWN_HOST_DOMAIN = DomainString("unknown");

/** EVM transfer helpers (decode, amount formatting, host/chain labels). */
export class TransactionUtils implements ITransactionUtils {
  constructor(private readonly hostOriginProvider: IHostOriginProvider) {}

  tryDecodeErc20Transfer(
    to: EVMContractAddress | null,
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

  resolveHostDomain(): DomainString {
    return this.hostOriginProvider.getHostDomain() ?? UNKNOWN_HOST_DOMAIN;
  }

  chainLabelFor(
    chainId: EVMChainId | string | number,
    chains: ReadonlyArray<{ chainId: EVMChainId | string | number; label: string }>,
  ): string {
    return (
      chains.find((chain) => String(chain.chainId) === String(chainId))?.label ??
      String(chainId)
    );
  }
}
