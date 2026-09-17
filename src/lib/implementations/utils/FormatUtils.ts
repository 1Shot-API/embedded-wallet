import { formatUnits } from "viem";

/** Max fractional digits shown for token balances in the wallet UI. */
export const DISPLAY_TOKEN_FRACTION_DIGITS = 8;

/** Display formatting for token amounts in the Branding Layer UI. */
export class FormatUtils {
  /**
   * Format atomic token units for display: at most
   * {@link DISPLAY_TOKEN_FRACTION_DIGITS} fraction digits, no zero-padding,
   * trailing zeros stripped.
   */
  static formatDisplayTokenAmount(balance: bigint, decimals: number): string {
    return FormatUtils.trimDisplayTokenAmount(formatUnits(balance, decimals));
  }

  /**
   * Cap / trim an already-decimalized amount string (e.g. from `formatUnits`).
   */
  static trimDisplayTokenAmount(
    amount: string,
    maxFractionDigits: number = DISPLAY_TOKEN_FRACTION_DIGITS,
  ): string {
    const negative = amount.startsWith("-");
    const unsigned = negative ? amount.slice(1) : amount;
    const dot = unsigned.indexOf(".");
    if (dot < 0) {
      return amount;
    }

    const intPart = unsigned.slice(0, dot);
    const fracPart = unsigned
      .slice(dot + 1, dot + 1 + maxFractionDigits)
      .replace(/0+$/, "");

    const formatted = fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
    return negative ? `-${formatted}` : formatted;
  }
}
