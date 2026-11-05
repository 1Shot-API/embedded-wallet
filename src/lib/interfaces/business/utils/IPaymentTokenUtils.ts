import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
} from "@1shotapi/ows-types";

import type { IRelayerPayment } from "../../../types/domain/RelayerPayment";
import type { IPaymentTokenOption } from "../ITransactionService";

export const IPaymentTokenUtilsType = Symbol.for("IPaymentTokenUtils");

/**
 * Centralized selection of which chain + token pays the public-relayer fee.
 * Work chains (Arc preferred) → Arc → other funded chains on the same relayer.
 *
 * Candidates are limited to chains whose `relayerUrl` matches the execution
 * chains. Mainnet and testnet are different relayer deployments, so a testnet
 * stablecoin is not offered for mainnet work, and a mainnet stablecoin is not
 * offered for testnet work. When execution chains disagree on `relayerUrl`,
 * only those execution chains are candidates.
 */
export interface IPaymentTokenUtils {
  /**
   * Pick payment for work on `executionChainIds`.
   *
   * 1. `preferredToken` wins on any candidate chain (execution → Arc → others).
   * 2. Among funded execution chains, prefer Arc when funded; else first funded.
   * 3. Else Arc USDC when it is funded and on the same relayer.
   * 4. Else first other funded payment token on that same relayer.
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
   * Payment-token options across execution chains, Arc, and other funded
   * chains on the same relayer — for the fee-picker Select.
   */
  listPaymentOptions(
    owner: EVMAccountAddress,
    executionChainIds: readonly EVMChainId[],
  ): Promise<IPaymentTokenOption[]>;
}
