import { startAuthentication } from "@simplewebauthn/browser";
import type { IWebAuthnAssertionRequest } from "./types";
import type { RelayerCredentialsClient } from "./RelayerCredentialsClient";

/**
 * Fetch a single-use challenge and complete a WebAuthn assertion for the
 * wallet passkey. Used to authenticate every mutative/recover relayer call.
 */
export async function createRelayerAssertion(
  client: RelayerCredentialsClient,
  webauthnCredentialId: string,
): Promise<IWebAuthnAssertionRequest> {
  const { challengeId, challenge } = await client.createChallenge();

  const assertion = await startAuthentication({
    optionsJSON: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: webauthnCredentialId,
          type: "public-key",
        },
      ],
      userVerification: "required",
    },
  });

  return {
    challengeId,
    credentialId: assertion.id,
    authenticatorData: assertion.response.authenticatorData,
    clientDataJSON: assertion.response.clientDataJSON,
    signature: assertion.response.signature,
  };
}
