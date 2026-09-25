/**
 * App-owned readiness gate for host-driven actions.
 *
 * Branding wrappers (`registerApprovalSigning`, `registerCredentialsProvider`)
 * take optional setup / unlock callbacks. Some flows (e.g. `present`) also need
 * credentials in the local cache before they can match / show consent. Custom
 * RPCs that need an address or vault (`onramp`, `bridge`, `getUpgraded`,
 * `addAsset`, future 7710/delegation sends) should wrap handlers with
 * {@link withWalletReady} so unlock/setup is never forgotten when new methods
 * are added. Shell-only RPCs (`configure`, `switchChain`, `focusWallet`,
 * `createAccount`) do not unlock.
 *
 * Full `ensureReady` owns:
 * - unlocked → no-op
 * - cached credential id → passkey unlock (+ credential recover when cache empty)
 * - otherwise → setup modal (login existing / create new), then recover
 *
 * For **signed** EIP-1193 actions (`personal_sign`, typed data, `eth_sendTransaction`),
 * in-wallet send, and credential **issue/present PoP**: use
 * `ensureOnboardedForSigning` (or equivalent):
 * - session already unlocked → no-op; the signing / PoP ceremony authenticates
 * - session locked → full `ensureReady` (unlock or setup) so SIWE and other
 *   host-driven signs never fail with a locked wallet
 * Pair with `onAuthenticated` (inside branding `approveAnd*` /
 * `approveAndAcceptOffer` / `approveAndPresent`) to mark unlocked and refresh
 * addresses after a successful ceremony.
 */

export type WalletReadyGate = () => Promise<void>;

/**
 * Wrap a host RPC / credential handler so it always runs after {@link ensureReady}.
 * Use for actions that need an unlocked signer before any other work
 * (e.g. credential delete). Prefer `ensureOnboardedForSigning` on
 * `approveAndSign*` / credential `approveAnd*` for signed actions.
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
 * - Cache already warm → return; caller should not unlock again after consent
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
