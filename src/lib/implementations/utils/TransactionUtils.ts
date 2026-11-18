import {
  type DomainString,
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
  IDecodedErc20Call,
  ITransactionUtils,
} from "../../interfaces/utils/ITransactionUtils";

import { UNKNOWN_HOST_DOMAIN } from "./HostOriginProvider";

/** 2^255. Approvals at or above this display as unlimited. */
const UNLIMITED_APPROVAL = 1n << 255n;

/** EVM token helpers (ERC-20 decode, amount formatting, host/chain labels). */
export class TransactionUtils implements ITransactionUtils {
  constructor(private readonly hostOriginProvider: IHostOriginProvider) {}

  tryDecodeErc20(
    to: EVMContractAddress | null,
    data: HexString,
  ): IDecodedErc20Call | null {
    if (!to || !data || String(data) === "0x" || data.length < 10) {
      return null;
    }
    try {
      const decoded = decodeFunctionData({
        abi: erc20Abi,
        data: data as Hex,
      });
      if (decoded.functionName === "transfer") {
        const [recipient, amount] = decoded.args as readonly [
          `0x${string}`,
          bigint,
        ];
        return {
          kind: "transfer",
          tokenAddress: to,
          recipient: EVMAccountAddress(getAddress(recipient)),
          amount,
        };
      }
      if (decoded.functionName === "approve") {
        const [spender, amount] = decoded.args as readonly [
          `0x${string}`,
          bigint,
        ];
        return {
          kind: "approve",
          tokenAddress: to,
          spender: EVMAccountAddress(getAddress(spender)),
          amount,
        };
      }
      return null;
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

  formatErc20ApproveAmount(amount: bigint, decimals: number): string {
    if (amount >= UNLIMITED_APPROVAL) return "Unlimited";
    return this.formatTokenAmount(amount, decimals);
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
