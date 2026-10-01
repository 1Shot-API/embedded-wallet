import type {
  EVMAccountAddress,
  EVMContractAddress,
} from "@1shotapi/ows-types";
import { parseAbi } from "viem";
import type { ITransactionWork } from "../ITransactionService";

/** Minimal ERC-4626 surface used for Morpho Earn vaults. */
export const earn4626Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewWithdraw(uint256 assets) view returns (uint256)",
  "function maxWithdraw(address owner) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
]);

export type Earn4626Abi = typeof earn4626Abi;

export type IBuildEarnDepositWorkParams = {
  usdcAddress: EVMContractAddress;
  vaultAddress: EVMContractAddress;
  owner: EVMAccountAddress;
  amountAtoms: bigint;
  usdcAllowance: bigint;
};

export type IBuildEarnWithdrawWorkParams = {
  vaultAddress: EVMContractAddress;
  owner: EVMAccountAddress;
  amountAtoms: bigint;
};

/**
 * Morpho ERC-4626 Earn helpers: vault ABI + approve/deposit/withdraw encoding
 * for the EIP-7710 relayer. Stateless — safe as a singleton.
 */
export interface IEarnUtils {
  readonly erc4626Abi: Earn4626Abi;

  buildDepositWork(params: IBuildEarnDepositWorkParams): ITransactionWork[];

  buildWithdrawWork(params: IBuildEarnWithdrawWorkParams): ITransactionWork[];
}

export const IEarnUtilsType = Symbol.for("business.IEarnUtils");
