import {
  ClearSigningFormatter,
  ClearSigningUtils,
  type IClearSigningEnvironment,
  type IClearSigningTypedData,
} from "@1shotapi/ows-clear-signing";
import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  HexString,
} from "@1shotapi/ows-types";

import type { IClearSigningService } from "../../interfaces/business/IClearSigningService";
import type { IClearSigningRepository } from "../../interfaces/data/IClearSigningRepository";
import {
  ClearSigningPresentation,
  type IClearSigningPresentation,
} from "../../types/domain/ClearSigningPresentation";

/** {@link IClearSigningService}: registry lookup via the relayer, rendering via `ClearSigningFormatter`. */
export class ClearSigningService implements IClearSigningService {
  private readonly formatter: ClearSigningFormatter;

  constructor(
    private readonly repository: IClearSigningRepository,
    environment: IClearSigningEnvironment,
  ) {
    this.formatter = new ClearSigningFormatter(environment);
  }

  async describeTransaction(
    chainId: EVMChainId,
    from: EVMAccountAddress,
    to: EVMContractAddress,
    data: HexString,
    value: HexString,
  ): Promise<IClearSigningPresentation | null> {
    try {
      const key = ClearSigningUtils.calldataLookupKey(chainId, to, data);
      if (!key) return null;
      const found = await this.repository.lookupCalldata(key);
      if (!found) return null;
      const display = await this.formatter.formatCalldata(found.descriptor, {
        chainId,
        from,
        to,
        data,
        value,
      });
      return new ClearSigningPresentation(
        display,
        found.registrySha,
        found.path,
      );
    } catch (error: unknown) {
      console.warn(
        "[clear-signing] transaction descriptor not applied; using generic display",
        error,
      );
      return null;
    }
  }

  async describeTypedData(
    typedData: IClearSigningTypedData,
    signer: EVMAccountAddress,
  ): Promise<IClearSigningPresentation | null> {
    try {
      const key = ClearSigningUtils.eip712LookupKey(typedData);
      if (!key) return null;
      const found = await this.repository.lookupEip712(key);
      if (!found) return null;
      const display = await this.formatter.formatTypedData(
        found.descriptor,
        typedData,
        signer,
      );
      return new ClearSigningPresentation(
        display,
        found.registrySha,
        found.path,
      );
    } catch (error: unknown) {
      console.warn(
        "[clear-signing] typed-data descriptor not applied; using generic display",
        error,
      );
      return null;
    }
  }
}
