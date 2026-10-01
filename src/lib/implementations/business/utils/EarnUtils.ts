import { encodeFunctionData, erc20Abi } from "viem";
import { HexString } from "@1shotapi/ows-types";
import type { ITransactionWork } from "../../../interfaces/business/ITransactionService";
import {
  earn4626Abi,
  type IBuildEarnDepositWorkParams,
  type IBuildEarnWithdrawWorkParams,
  type IEarnUtils,
} from "../../../interfaces/business/utils/IEarnUtils";

/**
 * Morpho ERC-4626 Earn encoding for the public relayer.
 * Stateless — construct once and inject.
 */
export class EarnUtils implements IEarnUtils {
  readonly erc4626Abi = earn4626Abi;

  /**
   * Encode USDC approve (if needed) + ERC-4626 deposit for the public relayer.
   */
  buildDepositWork(params: IBuildEarnDepositWorkParams): ITransactionWork[] {
    const depositData = HexString(
      encodeFunctionData({
        abi: this.erc4626Abi,
        functionName: "deposit",
        args: [params.amountAtoms, params.owner],
      }),
    );
    const deposit: ITransactionWork = {
      to: params.vaultAddress,
      data: depositData,
      value: 0n,
    };
    if (params.usdcAllowance >= params.amountAtoms) {
      return [deposit];
    }
    const approveData = HexString(
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [params.vaultAddress, params.amountAtoms],
      }),
    );
    return [
      {
        to: params.usdcAddress,
        data: approveData,
        value: 0n,
      },
      deposit,
    ];
  }

  /**
   * Encode ERC-4626 withdraw. When the relayer executes as the owner (EIP-7702),
   * Morpho burns shares without a separate share approval.
   */
  buildWithdrawWork(params: IBuildEarnWithdrawWorkParams): ITransactionWork[] {
    return [
      {
        to: params.vaultAddress,
        data: HexString(
          encodeFunctionData({
            abi: this.erc4626Abi,
            functionName: "withdraw",
            args: [params.amountAtoms, params.owner, params.owner],
          }),
        ),
        value: 0n,
      },
    ];
  }
}
