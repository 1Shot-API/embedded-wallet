import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
} from "@1shotapi/ows-types";
import type { IPaymentTokenOption } from "../ITransactionService";
import type { IRelayerPayment } from "../../../types/domain/RelayerPayment";

export const IPaymentTokenUtilsType = Symbol.for("IPaymentTokenUtils");

/**
 * Centralized selection of which chain + token pays the public-relayer fee.
 * Work chains (Arc preferred) → Arc → other wallet relayer chains.
 */
export interface IPaymentTokenUtils {
  /**
   * Pick payment for work on `executionChainIds`.
   *
   * 1. `preferredToken` wins on any candidate chain (execution → Arc → others).
   * 2. Among funded execution chains, prefer Arc when funded; else first funded.
   * 3. Else Arc USDC when funded (even if Arc is not an execution chain).
   * 4. Else first other wallet relayer chain with a funded payment token.
   * 5. Else null.
   *
   * Token pick within a chain: USDC → USDT → first funded (`preferredToken` wins).
   */
  resolvePayment(
    owner: EVMAccountAddress,
    executionChainIds: readonly EVMChainId[],
    preferredToken?: EVMContractAddress,
  ): Promise<IRelayerPayment | null>;

  /**
   * All payment-token options across execution chains, Arc, and other funded
   * relayer chains — for the fee-picker Select.
   */
  listPaymentOptions(
    owner: EVMAccountAddress,
    executionChainIds: readonly EVMChainId[],
  ): Promise<IPaymentTokenOption[]>;
}
