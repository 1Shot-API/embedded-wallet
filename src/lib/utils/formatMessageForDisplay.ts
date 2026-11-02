import { ConversionUtils, HexString } from "@1shotapi/ows-types";

import { isMostlyPrintable } from "./isMostlyPrintable";

/** Prefer UTF-8 when an EVM personal_sign hex payload decodes cleanly. */
export function formatMessageForDisplay(message: string): string {
  if (message.startsWith("0x") && message.length > 2) {
    try {
      const bytes = ConversionUtils.hexToBytes(
        HexString(message as `0x${string}`),
      );
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (isMostlyPrintable(decoded)) {
        return decoded;
      }
    } catch {
      // fall through
    }
  }
  return message;
}
