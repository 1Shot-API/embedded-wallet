import type { SignTypedDataPayload } from "@1shotapi/ows-signer-utils";
import { ConversionUtils, HexString } from "@1shotapi/ows-types";
import type { ISIWEUtils } from "../../interfaces/utils/ISIWEUtils";
import type { ISiweFields } from "../../types/domain/SiweFields";

const SIWE_PRIMARY_TYPE = /SignInWithEthereum|SiweMessage|Login/i;
const SIWE_PREAMBLE = /wants you to sign in with your Ethereum account/i;

const CORE_TYPED_KEYS = [
  "domain",
  "address",
  "uri",
  "version",
  "chainId",
  "nonce",
] as const;

/** Heuristic EIP-4361 / SIWE parsers for branding consent UI. */
export class SIWEUtils implements ISIWEUtils {
  decodePersonalSignMessage(message: string): string {
    if (!message.startsWith("0x") || message.length <= 2) {
      return message;
    }
    try {
      const bytes = ConversionUtils.hexToBytes(
        HexString(message as `0x${string}`),
      );
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (this.isMostlyPrintable(decoded)) {
        return decoded;
      }
    } catch {
      // fall through
    }
    return message;
  }

  tryParseTypedData(typedData: SignTypedDataPayload): ISiweFields | null {
    const message = typedData.message;
    if (!message || typeof message !== "object") {
      return null;
    }

    const byPrimaryType = SIWE_PRIMARY_TYPE.test(typedData.primaryType);
    const byFields = CORE_TYPED_KEYS.every((key) => {
      const value = message[key];
      return value !== undefined && value !== null && String(value).length > 0;
    });

    if (!byPrimaryType && !byFields) {
      return null;
    }

    const domain = this.readString(message, "domain");
    const uri = this.readString(message, "uri");
    const version = this.readString(message, "version");
    const chainId = this.readString(message, "chainId");
    const nonce = this.readString(message, "nonce");

    if (!domain || !uri || !version || !chainId || !nonce) {
      // Primary-type match without enough fields: still attempt extraction from
      // what is present; require at least domain + chainId for a usable UI.
      if (!domain || !chainId) {
        return null;
      }
    }

    const resources = this.readResources(message.resources);

    return {
      domain: domain ?? "",
      uri: uri ?? "",
      version: version ?? "",
      chainId: chainId ?? "",
      nonce: nonce ?? "",
      address: this.readString(message, "address"),
      statement: this.readString(message, "statement"),
      issuedAt: this.readString(message, "issuedAt"),
      expirationTime: this.readString(message, "expirationTime"),
      notBefore: this.readString(message, "notBefore"),
      requestId: this.readString(message, "requestId"),
      resources: resources.length > 0 ? resources : undefined,
    };
  }

  tryParsePersonalMessage(message: string): ISiweFields | null {
    const text = this.decodePersonalSignMessage(message).replace(/\r\n/g, "\n");
    if (!text.trim()) {
      return null;
    }

    const hasPreamble = SIWE_PREAMBLE.test(text);
    const hasUri = /^URI:\s*.+/m.test(text);
    const hasVersion = /^Version:\s*.+/m.test(text);
    const hasChainId = /^Chain ID:\s*.+/m.test(text);
    const hasNonce = /^Nonce:\s*.+/m.test(text);

    if (!hasPreamble && !(hasUri && hasVersion && hasChainId && hasNonce)) {
      return null;
    }

    const lines = text.split("\n");
    const firstLine = lines[0]?.trim() ?? "";
    const domainFromPreamble = firstLine.replace(
      /\s+wants you to sign in with your Ethereum account:?$/i,
      "",
    );

    let address: string | undefined;
    let statement: string | undefined;
    const addressLine = lines[1]?.trim();
    if (addressLine && /^0x[a-fA-F0-9]{40}$/.test(addressLine)) {
      address = addressLine;
    }

    // EIP-4361: optional statement between blank lines after address and before URI
    const uriIndex = lines.findIndex((line) => /^URI:\s*/i.test(line));
    if (uriIndex > 2) {
      const statementLines = lines.slice(2, uriIndex).filter((l) => l.trim());
      if (statementLines.length > 0) {
        statement = statementLines.join("\n");
      }
    }

    const uri = this.readAbnfField(text, "URI") ?? "";
    const version = this.readAbnfField(text, "Version") ?? "";
    const chainId = this.readAbnfField(text, "Chain ID") ?? "";
    const nonce = this.readAbnfField(text, "Nonce") ?? "";
    const issuedAt = this.readAbnfField(text, "Issued At");
    const expirationTime = this.readAbnfField(text, "Expiration Time");
    const notBefore = this.readAbnfField(text, "Not Before");
    const requestId = this.readAbnfField(text, "Request ID");
    const resources = this.readAbnfResources(text);

    const domain =
      domainFromPreamble && domainFromPreamble !== firstLine
        ? domainFromPreamble
        : (this.extractHostFromUri(uri) ?? domainFromPreamble);

    if (!domain || !chainId) {
      return null;
    }

    return {
      domain,
      uri,
      version,
      chainId,
      nonce,
      address,
      statement,
      issuedAt,
      expirationTime,
      notBefore,
      requestId,
      resources: resources.length > 0 ? resources : undefined,
    };
  }

  private readString(
    message: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = message[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
    return undefined;
  }

  private readResources(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item)))
      .filter((s) => s.length > 0);
  }

  private readAbnfField(text: string, label: string): string | undefined {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`^${escaped}:\\s*(.+)$`, "im"));
    const value = match?.[1]?.trim();
    return value && value.length > 0 ? value : undefined;
  }

  private readAbnfResources(text: string): string[] {
    const lines = text.split("\n");
    const collected: string[] = [];
    let inResources = false;
    for (const line of lines) {
      if (/^Resources:\s*/i.test(line)) {
        inResources = true;
        const inline = line.replace(/^Resources:\s*/i, "").trim();
        if (inline) collected.push(inline);
        continue;
      }
      if (!inResources) continue;
      const bullet = line.match(/^-\s+(.+)$/);
      if (bullet?.[1]) {
        collected.push(bullet[1].trim());
        continue;
      }
      if (line.trim() === "") continue;
      break;
    }
    return collected;
  }

  private extractHostFromUri(uri: string): string | undefined {
    try {
      const url = new URL(uri);
      return url.host || undefined;
    } catch {
      return undefined;
    }
  }

  private isMostlyPrintable(text: string): boolean {
    if (!text.trim()) return false;
    let printable = 0;
    let codePoints = 0;
    for (const char of text) {
      codePoints++;
      const code = char.codePointAt(0) ?? 0;
      if (code >= 32 && code !== 127) printable++;
    }
    return codePoints > 0 && printable / codePoints >= 0.85;
  }
}
