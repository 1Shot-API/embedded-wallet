/** Normalized EIP-4361 / SIWE fields for the consent modal. */
export interface ISiweFields {
  domain: string;
  uri: string;
  version: string;
  chainId: string;
  nonce: string;
  address?: string;
  statement?: string;
  issuedAt?: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}
