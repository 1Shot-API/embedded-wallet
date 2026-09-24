import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type { IRelayerPayment } from "../../../types/domain/RelayerPayment";

export const IPaymentTokenUtilsType = Symbol.for("IPaymentTokenUtils");

/**
 * Centralized selection of which chain + token pays the public-relayer fee.
 * Local-first on the execution chain(s), then Arc USDC fallback.
 */
export interface IPaymentTokenUtils {
  /**
   * Pick payment for work on `executionChainIds`.
   *
   * 1. If exactly one execution chain has a funded relayer payment token,
   *    use that chain (USDC → USDT → first; `preferredToken` wins on that chain).
   * 2. Else if Arc has funded USDC, use Arc USDC.
   * 3. Else first execution chain with any funded payment token.
   * 4. Else null.
   */
  resolvePayment(
    owner: EVMAccountAddress,
    executionChainIds: readonly EVMChainId[],
    preferredToken?: EVMAccountAddress,
  ): Promise<IRelayerPayment | null>;
}
