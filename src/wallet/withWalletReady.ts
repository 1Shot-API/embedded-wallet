/**
 * App-owned readiness gate for host-driven actions.
 *
 * Branding wrappers (`registerApprovalSigning`, `CredentialsHelper`) take an
 * optional `ensureReady` callback. Some flows (e.g. `present`) also need
 * credentials in the local cache before they can match / show consent. Custom
 * RPCs (`eth_sendTransaction`, future 7710/delegation sends) should use the
 * same centralized gate pattern so unlock/setup is never forgotten when new
 * methods are added.
 *
 * Full `ensureReady` owns:
 * - unlocked → no-op
 * - cached credential id → passkey unlock (+ credential recover when cache empty)
 * - otherwise → setup modal (login existing / create new), then recover
 *
 * For **signed** EIP-1193 actions (`personal_sign`, typed data, `eth_sendTransaction`)
 * and in-wallet send: pass a setup-only gate — run setup/login only when no
 * credential id exists. With a known credential, skip a separate `getPublicKey`
 * unlock; the signing / approve-transaction ceremony itself authenticates. Pair
 * with `onAuthenticated` (inside branding `approveAndSign*`) to mark unlocked
 * and refresh addresses after a successful sign.
 */

export type WalletReadyGate = () => Promise<void>;

/**
 * Wrap a host RPC / credential handler so it always runs after {@link ensureReady}.
 * Use for actions that need an unlocked signer before any other work
 * (e.g. credential mutate paths). Prefer branding setup-only gates on
 * `approveAndSign*` for signing / transaction methods.
 */
export function withWalletReady<TArgs extends unknown[], TResult>(
  ensureReady: WalletReadyGate,
  handler: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    await ensureReady();
    return handler(...args);
  };
}

/**
 * Gate for credential *reads* that must see a warm local cache (present/list).
 *
 * - No wallet yet → full {@link ensureReady} (setup / discoverable login + recover)
 * - Wallet exists but cache empty → {@link ensureReady} (unlock + recover)
 * - Cache already warm → return; caller may still unlock later after consent
 *   (single passkey for PoP when a credential id is already known)
 */
export async function ensureCredentialsReadable(options: {
  ensureReady: WalletReadyGate;
  isWalletCreated: () => boolean;
  listLocal: () => Promise<readonly unknown[]>;
}): Promise<void> {
  if (!options.isWalletCreated()) {
    await options.ensureReady();
    return;
  }
  const listed = await options.listLocal();
  if (listed.length === 0) {
    await options.ensureReady();
  }
}
