/** Middle-truncated address for compact rows (full value stays in `title`). */
export function truncateAddress(address: string): string {
  if (address.length <= 13) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Favicon for a requesting host domain; loaded through `SafeAssetImage`. */
export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}
