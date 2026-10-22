import { isMostlyPrintable } from "./isMostlyPrintable";

/** UTF-8 when printable; otherwise lowercase hex for Solana message previews. */
export function bytesToDisplay(bytes: Uint8Array): string {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (isMostlyPrintable(decoded)) {
      return decoded;
    }
  } catch {
    // fall through
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
