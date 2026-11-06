import type { Eip1193Handler, OWSWallet } from "@1shotapi/ows-wallet-utils";

/**
 * Records every EIP-1193 handler registered on an `OWSWallet` so wallet-local
 * RPCs (see `registerForwardEip1193Rpc`) can invoke one by method name.
 *
 * `OWSWallet` keeps its handler table private and exposes no dispatch entry
 * point, so this wraps `registerEip1193` on the instance; it must be created
 * before any handler is registered.
 */
export class Eip1193HandlerRegistry {
  private readonly handlers = new Map<string, Eip1193Handler>();

  constructor(wallet: OWSWallet) {
    const register = wallet.registerEip1193.bind(wallet);
    wallet.registerEip1193 = (method, handler) => {
      this.handlers.set(method, handler);
      register(method, handler);
    };
  }

  get(method: string): Eip1193Handler | undefined {
    return this.handlers.get(method);
  }
}
