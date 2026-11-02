/** True when enough of `text` is printable (for sign-message previews). */
export function isMostlyPrintable(text: string): boolean {
  if (!text.trim()) return false;
  let printable = 0;
  let codePoints = 0;
  for (const char of text) {
    codePoints++;
    const code = char.codePointAt(0) ?? 0;
    if (
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code !== 0x7f)
    ) {
      printable++;
    }
  }
  return codePoints > 0 && printable / codePoints >= 0.85;
}
