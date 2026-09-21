const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Present EIP-712 field keys for consent UI labels. */
export function humanizeEip712Key(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) {
    return "";
  }
  const withSpaces = trimmed
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

export function isEvmAddressString(value: string): boolean {
  return EVM_ADDRESS_RE.test(value.trim());
}

export function formatEip712Primitive(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function isEip712NestedValue(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

/** Read `chainId` from an EIP-712 domain object for network resolution. */
export function readDomainChainId(domain: unknown): string | null {
  if (!domain || typeof domain !== "object") {
    return null;
  }
  const raw = (domain as Record<string, unknown>).chainId;
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "bigint") {
    return raw.toString();
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return null;
}

export type IEip712DomainField = {
  key: string;
  value: unknown;
};

/** Domain rows in stable EIP-712 order; omits empty values and `chainId` (shown via network row). */
export function domainFieldEntries(domain: unknown): IEip712DomainField[] {
  if (!domain || typeof domain !== "object") {
    return [];
  }
  const record = domain as Record<string, unknown>;
  const order = ["name", "version", "verifyingContract", "salt"] as const;
  const entries: IEip712DomainField[] = [];
  for (const key of order) {
    if (!(key in record)) {
      continue;
    }
    const value = record[key];
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string" && !value.trim()) {
      continue;
    }
    entries.push({ key, value });
  }
  for (const key of Object.keys(record)) {
    if (key === "chainId" || order.includes(key as (typeof order)[number])) {
      continue;
    }
    const value = record[key];
    if (value === null || value === undefined) {
      continue;
    }
    entries.push({ key, value });
  }
  return entries;
}

export function readVerifyingContract(domain: unknown): string | null {
  if (!domain || typeof domain !== "object") {
    return null;
  }
  const raw = (domain as Record<string, unknown>).verifyingContract;
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
