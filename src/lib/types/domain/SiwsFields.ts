import type {
  SolanaAccountAddress,
  SolanaChainId,
} from "@1shotapi/ows-types";

/** Normalized SIWS fields for the consent modal (after wallet defaults). */
export interface ISiwsFields {
  domain: string;
  address: SolanaAccountAddress;
  uri: string;
  version: string;
  chainId: SolanaChainId;
  nonce: string;
  statement?: string;
  issuedAt?: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}
