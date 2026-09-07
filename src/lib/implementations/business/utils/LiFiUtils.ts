import {
  EVMContractAddress,
  HexString,
  type EVMChainId,
} from "@1shotapi/ows-types";
import {
  encodePacked,
  getAddress,
  isHex,
  type Hex,
} from "viem";
import { EChain } from "../../../types/enum/EChain";
import type {
  ILiFiSwapTerms,
  ILiFiUtils,
} from "../../../interfaces/business/utils/ILiFiUtils";

const TERMS_LENGTH = 284;
const DEFAULT_SLIPPAGE_BPS = 50;

/**
 * LiFiSwapEnforcer deployments keyed by source chain.
 * @see https://github.com/1Shot-API/delegation-framework/tree/deployment/Base/scripts/lifi-swap
 */
const ENFORCER_BY_CHAIN: ReadonlyMap<string, EVMContractAddress> = new Map([
  [
    String(EChain.Base).toLowerCase(),
    EVMContractAddress("0x47472E8AA7012D1c23336aa28514AE94389318f5"),
  ],
]);

/**
 * LiFiSwapEnforcer deployments and terms encoding.
 * Stateless — construct once and inject.
 */
export class LiFiUtils implements ILiFiUtils {
  readonly termsLength = TERMS_LENGTH;
  readonly defaultSlippageBps = DEFAULT_SLIPPAGE_BPS;

  resolveSwapEnforcer(chainId: EVMChainId | string): EVMContractAddress | null {
    return ENFORCER_BY_CHAIN.get(String(chainId).toLowerCase()) ?? null;
  }

  encodeTerms(terms: ILiFiSwapTerms): HexString {
    assertBytes32(terms.outputAssetId, "outputAssetId");
    assertBytes32(terms.outputRecipient, "outputRecipient");

    const encoded = encodePacked(
      [
        "address",
        "address",
        "bytes32",
        "bytes32",
        "uint256",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
      ],
      [
        getAddress(terms.lifiDiamond),
        getAddress(terms.inputToken),
        terms.outputAssetId,
        terms.outputRecipient,
        terms.destinationChainId,
        getAddress(terms.quoteSigner),
        terms.periodAmount,
        terms.periodDuration,
        terms.startDate,
        terms.slippageBps,
      ],
    );

    const byteLength = (encoded.length - 2) / 2;
    if (byteLength !== this.termsLength) {
      throw new Error(
        `Invalid LiFi terms length: expected ${this.termsLength}, got ${byteLength}`,
      );
    }
    return HexString(encoded);
  }
}

function assertBytes32(value: string, field: string): asserts value is Hex {
  if (!isHex(value) || (value.length - 2) / 2 !== 32) {
    throw new Error(`${field} must be a 32-byte hex string`);
  }
}
