/** Fields of `browser.runtime.MessageSender` this module reads. */
export interface IMessageSenderLike {
  origin?: string;
  url?: string;
  frameId?: number;
  tab?: { url?: string };
}

/**
 * Browser-attested origin of a content-script request.
 *
 * Prefers `sender.origin` (Chromium), then the sending frame's URL, then the
 * tab URL (Firefox). Only top-frame senders over http(s) qualify; opaque,
 * internal, and sub-frame senders yield `null` and must be refused. The
 * content script cannot influence any of these fields.
 */
export function resolveSenderOrigin(sender: IMessageSenderLike): string | null {
  if (sender.frameId !== undefined && sender.frameId !== 0) {
    return null;
  }
  for (const candidate of [sender.origin, sender.url, sender.tab?.url]) {
    if (!candidate) continue;
    const origin = toWebOrigin(candidate);
    if (origin) return origin;
  }
  return null;
}

/** `https://host[:port]` for an http(s) URL or origin string; otherwise `null`. */
export function toWebOrigin(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  return parsed.origin === "null" ? null : parsed.origin;
}
