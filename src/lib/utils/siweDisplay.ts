import {
  ChainUtils,
  type EVMChainId,
} from "@1shotapi/ows-types";

/** Lowercase host for SIWE origin comparison (strips port). */
export function normalizeSiweHost(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  try {
    const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    return url.hostname.toLowerCase();
  } catch {
    const withoutPort = trimmed.split(":")[0] ?? trimmed;
    return withoutPort.replace(/^\[/, "").replace(/\]$/, "");
  }
}

/** True when the SIWE URI points at the same host as `domain` (path/query ignored). */
export function isSiweUriRedundant(uri: string, domain: string): boolean {
  const uriHost = normalizeSiweHost(uri);
  const domainHost = normalizeSiweHost(domain);
  if (!uriHost || !domainHost) {
    return false;
  }
  return uriHost === domainHost;
}

/** Parse decimal or hex chain id from EIP-4361 fields into `EVMChainId`, or null. */
export function resolveSiweEvmChainId(chainIdRaw: string): EVMChainId | null {
  const trimmed = chainIdRaw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return ChainUtils.asEVMChainId(trimmed);
  } catch {
    return null;
  }
}
