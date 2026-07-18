import {
  CredentialIssuer,
  type IIssuerTrustRegistry,
  type IssuerTrustMetadata,
} from "@1shotapi/ows-types";

/** MOCK KYC issuer — demo trust entry until production allow-lists land. */
export const MOCK_KYC_ISSUER_ID = CredentialIssuer(
  "https://kyc.demo.issuer.example",
);

const MOCK_ISSUER_TRUST: IssuerTrustMetadata = {
  issuerId: MOCK_KYC_ISSUER_ID,
  name: "Demo KYC Issuer",
  assuranceLevels: ["substantial", "high"],
  jurisdictions: ["US", "GB"],
};

/**
 * Hostnames trusted for demo OID4VCI offers (any path under the origin).
 * Includes local OWS demos and the 1Shot marketing playground issuer.
 */
const TRUSTED_DEMO_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "ows-host.com",
  "ows-issuer.com",
  "ows-verifier.com",
  "1shotapi.com",
  "www.1shotapi.com",
]);

/** True for local Vite / mkcert demos and the 1Shot site playground issuer. */
export function isTrustedDemoIssuerOrigin(issuerId: string): boolean {
  try {
    const url = new URL(issuerId);
    return (
      TRUSTED_DEMO_HOSTNAMES.has(url.hostname) ||
      url.hostname.endsWith(".ows-host.com") ||
      url.hostname.endsWith(".ows-issuer.com") ||
      url.hostname.endsWith(".ows-verifier.com") ||
      url.hostname.endsWith(".1shotapi.com")
    );
  } catch {
    return false;
  }
}

export class InMemoryIssuerTrustRegistry implements IIssuerTrustRegistry {
  constructor(
    private readonly entries: IssuerTrustMetadata[] = [MOCK_ISSUER_TRUST],
  ) {}

  async isTrustedIssuer(issuerId: CredentialIssuer): Promise<boolean> {
    const id = String(issuerId);
    if (isTrustedDemoIssuerOrigin(id)) return true;
    return this.entries.some((e) => e.issuerId === issuerId);
  }

  async resolveIssuer(
    issuerId: CredentialIssuer,
  ): Promise<IssuerTrustMetadata | undefined> {
    const found = this.entries.find((e) => e.issuerId === issuerId);
    if (found) return found;
    if (isTrustedDemoIssuerOrigin(String(issuerId))) {
      return {
        issuerId,
        name: "Demo KYC Issuer",
        assuranceLevels: ["substantial", "high"],
        jurisdictions: ["US", "GB"],
      };
    }
    return undefined;
  }

  async listIssuers(): Promise<IssuerTrustMetadata[]> {
    return [...this.entries];
  }
}
