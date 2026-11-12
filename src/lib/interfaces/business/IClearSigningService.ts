import type { IClearSigningTypedData } from "@1shotapi/ows-clear-signing";
import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  HexString,
} from "@1shotapi/ows-types";

import type { IClearSigningPresentation } from "../../types/domain/ClearSigningPresentation";

/**
 * ERC-7730 clear signing for consent modals: look the request up in the registry (via the
 * relayer) and render it with `ClearSigningFormatter`.
 *
 * Both methods resolve to `null` whenever the request cannot be clear-signed — no lookup key,
 * registry miss, relayer unreachable, or a descriptor that fails the formatter's binding checks —
 * and never throw. `null` means "show the generic display".
 */
export interface IClearSigningService {
  describeTransaction(
    chainId: EVMChainId,
    from: EVMAccountAddress,
    to: EVMContractAddress,
    data: HexString,
    value: HexString,
  ): Promise<IClearSigningPresentation | null>;

  describeTypedData(
    typedData: IClearSigningTypedData,
    signer: EVMAccountAddress,
  ): Promise<IClearSigningPresentation | null>;
}

export const IClearSigningServiceType = Symbol.for("IClearSigningService");
