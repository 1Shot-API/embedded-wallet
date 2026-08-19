import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  OwsUserRejectedError,
  type SolanaAccountAddress,
} from "@1shotapi/ows-types";

export type AccountConnectStorage = {
  loadCachedEvmAddress: () => EVMAccountAddress | undefined;
  saveCachedAddresses: (
    evm: EVMAccountAddress,
    solana?: SolanaAccountAddress,
  ) => void;
  /** True after the user has approved eth_accounts at least once this store. */
  loadAccountsPermissionGranted: () => boolean;
  saveAccountsPermissionGranted: () => void;
};

export type RegisterAccountConnectOptions = {
  storage: AccountConnectStorage;
  ensureReady: () => Promise<void>;
  requestConnectApproval: () => Promise<boolean>;
  /** Optional — used for EIP-1193 `connect` event payload. */
  getChainId?: () => Promise<string> | string;
};

type WalletPermission = {
  parentCapability: string;
  date?: number;
};

type DisplayHandle = {
  hide: () => Promise<void>;
};

/** Host Inline (extension side panel) can miss a second displayReady; don't block connect UX. */
const DISPLAY_ACQUIRE_TIMEOUT_MS = 2_000;

/**
 * Register `eth_accounts` / `eth_requestAccounts` (+ MetaMask-style permission
 * methods) on the wallet (pre-`start()`).
 *
 * EIP-1193 notes:
 * - `eth_accounts` returns the address only after a grant (not merely a cache).
 * - Reconnect (`eth_requestAccounts` with grant + cache) returns silently —
 *   no `accountsChanged` / `connect` spam on every dApp refresh.
 * - Those events fire only when the user newly approves a connect.
 */
export function registerAccountConnect(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterAccountConnectOptions,
): void {
  const hasGrantedAccounts = (): boolean =>
    options.storage.loadAccountsPermissionGranted();

  const markAccountsGranted = (): void => {
    options.storage.saveAccountsPermissionGranted();
  };

  /** Emit connect notifications after a fresh user approval. */
  const announceConnected = async (
    address: EVMAccountAddress,
  ): Promise<EVMAccountAddress[]> => {
    wallet.providerEvents.emit("accountsChanged", [address]);
    await emitConnect(wallet, options);
    return [address];
  };

  const resolveAccounts = async (): Promise<EVMAccountAddress[]> => {
    const cached = options.storage.loadCachedEvmAddress();

    // Already approved — MetaMask-like silent return (no display, no events).
    if (cached && hasGrantedAccounts()) {
      return [cached];
    }

    const display = await acquireDisplay(wallet);
    try {
      const approved = await options.requestConnectApproval();
      if (!approved) {
        throw new OwsUserRejectedError(
          "User rejected the account connection request",
        );
      }

      markAccountsGranted();

      if (cached) {
        return announceConnected(cached);
      }

      await options.ensureReady();
      const evm = await signer.evm.getAccountAddress();
      const solana = await signer.solana.getAccountAddress();
      options.storage.saveCachedAddresses(evm, solana);
      return announceConnected(evm);
    } finally {
      try {
        await display.hide();
      } catch {
        // Hide ack can stall on Inline hosts; connect already succeeded.
      }
    }
  };

  wallet.registerEip1193("eth_accounts", async () => {
    const cached = options.storage.loadCachedEvmAddress();
    if (cached && hasGrantedAccounts()) {
      return [cached];
    }
    return [];
  });

  wallet.registerEip1193("eth_requestAccounts", async () => resolveAccounts());

  // MetaMask / Uniswap often call these instead of / before eth_requestAccounts.
  wallet.registerEip1193("wallet_requestPermissions", async (params) => {
    const requested = normalizeRequestedPermissions(params);
    if (!requested.includes("eth_accounts")) {
      return [];
    }
    await resolveAccounts();
    return [
      {
        parentCapability: "eth_accounts",
        date: Date.now(),
      } satisfies WalletPermission,
    ];
  });

  wallet.registerEip1193("wallet_getPermissions", async () => {
    const cached = options.storage.loadCachedEvmAddress();
    if (!cached || !hasGrantedAccounts()) {
      return [];
    }
    return [
      {
        parentCapability: "eth_accounts",
        date: Date.now(),
      } satisfies WalletPermission,
    ];
  });
}

async function acquireDisplay(wallet: OWSWallet): Promise<DisplayHandle> {
  try {
    const session = await Promise.race([
      wallet.requestDisplay(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), DISPLAY_ACQUIRE_TIMEOUT_MS);
      }),
    ]);
    if (session) {
      return session;
    }
  } catch {
    // Fall through to a no-op handle — panel may already be Inline-visible.
  }
  return {
    hide: async () => {},
  };
}

async function emitConnect(
  wallet: OWSWallet,
  options: RegisterAccountConnectOptions,
): Promise<void> {
  try {
    const chainId = await options.getChainId?.();
    if (chainId) {
      wallet.providerEvents.emit("connect", { chainId });
    }
  } catch {
    // Best-effort; account return is enough for most dApps.
  }
}

function normalizeRequestedPermissions(params: unknown[]): string[] {
  const first = params[0];
  if (!first || typeof first !== "object") {
    return ["eth_accounts"];
  }
  return Object.keys(first as Record<string, unknown>);
}
