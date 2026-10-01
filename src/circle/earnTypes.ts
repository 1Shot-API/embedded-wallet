import type {
  EVMAccountAddress,
  EVMChainId,
} from "@1shotapi/ows-types";
import type { IEarnResult } from "../lib/interfaces/business/IEarnService";

export type EEarnMode = "deposit" | "withdraw";

/** Params for opening the Earn modal from Asset Details. */
export type IEarnOpenRequest = {
  chainId: EVMChainId;
  ownerAddress: EVMAccountAddress;
  /** Wallet USDC balance (available). */
  availableAtoms?: bigint | null;
  /** Pre-select deposit or withdraw. */
  mode?: EEarnMode;
};

export type IEarnModalResult = IEarnResult;
