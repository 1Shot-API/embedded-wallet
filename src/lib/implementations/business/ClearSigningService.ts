import {
  ClearSigningFormatter,
  ClearSigningUtils,
  type IClearSigningEnvironment,
  type IClearSigningTypedData,
} from "@1shotapi/ows-clear-signing";
import {
  ClearSigningRegistrySha,
  EClearSigningFieldFormat,
  EClearSigningVisibility,
  type EVMAccountAddress,
  type EVMChainId,
  type EVMContractAddress,
  type HexString,
  type IClearSigningDescriptor,
} from "@1shotapi/ows-types";

import type { IClearSigningService } from "../../interfaces/business/IClearSigningService";
import type { IClearSigningRepository } from "../../interfaces/data/IClearSigningRepository";
import {
  ClearSigningPresentation,
  type IClearSigningPresentation,
} from "../../types/domain/ClearSigningPresentation";

const ERC20_APPROVE_SELECTOR = "0x095ea7b3";
const LOCAL_ERC20_APPROVE_PATH = "local/erc20-approve";
/** 2^255. Amounts at or above this render as "Unlimited <symbol>". */
const UNLIMITED_APPROVAL_THRESHOLD =
  "0x8000000000000000000000000000000000000000000000000000000000000000";

type ILocalErc20 = { name: string; symbol: string; decimals: number };

type ILocalErc20Environment = IClearSigningEnvironment & {
  localErc20?(
    chainId: EVMChainId,
    address: EVMContractAddress,
  ): Promise<ILocalErc20 | null>;
};

/** {@link IClearSigningService}: registry lookup via the relayer, rendering via `ClearSigningFormatter`. */
export class ClearSigningService implements IClearSigningService {
  private readonly formatter: ClearSigningFormatter;

  constructor(
    private readonly repository: IClearSigningRepository,
    private readonly environment: ILocalErc20Environment,
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
      if (!found) {
        return await this.describeLocalErc20Approve(chainId, from, to, data, value);
      }
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

  /**
   * Registry miss for `approve(address,uint256)` on a tracked or catalog token.
   * Unknown contracts stay on the generic display.
   */
  private async describeLocalErc20Approve(
    chainId: EVMChainId,
    from: EVMAccountAddress,
    to: EVMContractAddress,
    data: HexString,
    value: HexString,
  ): Promise<IClearSigningPresentation | null> {
    if (data.slice(0, 10).toLowerCase() !== ERC20_APPROVE_SELECTOR) return null;
    const token = await this.environment.localErc20?.(chainId, to);
    if (!token) return null;

    const descriptor: IClearSigningDescriptor = {
      context: {
        contract: { deployments: [{ chainId, address: to }] },
      },
      metadata: {
        owner: token.name,
        contractName: token.symbol,
        token: { name: token.name, ticker: token.symbol, decimals: token.decimals },
      },
      format: {
        key: "approve(address _spender, uint256 _value)",
        intent: "Approve",
        fields: [
          {
            path: "_spender",
            label: "Spender",
            format: EClearSigningFieldFormat.AddressName,
            params: { types: ["eoa", "contract"] },
            visible: EClearSigningVisibility.Always,
          },
          {
            path: "_value",
            label: "Amount",
            format: EClearSigningFieldFormat.TokenAmount,
            params: {
              tokenPath: "@.to",
              threshold: UNLIMITED_APPROVAL_THRESHOLD,
            },
            visible: EClearSigningVisibility.Always,
          },
        ],
      },
    };

    const display = await this.formatter.formatCalldata(descriptor, {
      chainId,
      from,
      to,
      data,
      value,
    });
    return new ClearSigningPresentation(
      display,
      ClearSigningRegistrySha("local"),
      LOCAL_ERC20_APPROVE_PATH,
    );
  }
}
