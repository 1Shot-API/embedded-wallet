import type { EVMContractAddress } from "@1shotapi/ows-types";

/** On-chain EIP-7702 upgrade status for an EOA on one chain. */
export interface IWalletUpgradeStatus {
  upgraded: boolean;
  /** StatelessDelegator implementation when {@link upgraded} is true. */
  codeAddress?: EVMContractAddress;
}
