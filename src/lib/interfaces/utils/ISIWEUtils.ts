import type { SignTypedDataPayload } from "@1shotapi/ows-signer-utils";
import type { ISiweFields } from "../../types/domain/SiweFields";

/** Heuristic EIP-4361 / SIWE parsers for branding consent UI. */
export interface ISIWEUtils {
  /**
   * Decode a personal_sign payload to UTF-8 when it is hex-encoded.
   * Returns the original string when decoding is not appropriate.
   */
  decodePersonalSignMessage(message: string): string;

  /** Heuristic: EIP-712 payload looks like SIWE / login typed data. */
  tryParseTypedData(typedData: SignTypedDataPayload): ISiweFields | null;

  /** Heuristic: personal_sign UTF-8 (or hex) looks like EIP-4361 SIWE text. */
  tryParsePersonalMessage(message: string): ISiweFields | null;
}

export const ISIWEUtilsType = Symbol.for("ISIWEUtils");
