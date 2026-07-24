import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";
import type { IOWSProvider } from "../../interfaces/utils/IOWSProvider";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * Singleton-style holder for OWSSigner / OWSWallet / RpcHelper.
 * Constructed at module load; boot calls {@link setSigner} etc. when ready.
 */
export class OWSProvider implements IOWSProvider {
  private signer: OWSSigner | null = null;
  private wallet: OWSWallet | null = null;
  private rpcHelper: RpcHelper | null = null;

  private signerDeferred = createDeferred<OWSSigner>();
  private walletDeferred = createDeferred<OWSWallet>();
  private rpcHelperDeferred = createDeferred<RpcHelper>();

  constructor(private readonly configProvider: IConfigProvider) {}

  async getSigner(): Promise<OWSSigner> {
    if (this.signer) return this.signer;
    return this.signerDeferred.promise;
  }

  async getWallet(): Promise<OWSWallet> {
    if (this.wallet) return this.wallet;
    return this.walletDeferred.promise;
  }

  async getRpcHelper(): Promise<RpcHelper> {
    if (this.rpcHelper) return this.rpcHelper;
    return this.rpcHelperDeferred.promise;
  }

  setSigner(signer: OWSSigner): void {
    const first = this.signer === null;
    this.signer = signer;
    if (first) {
      this.signerDeferred.resolve(signer);
    }
  }

  setWallet(wallet: OWSWallet): void {
    const first = this.wallet === null;
    this.wallet = wallet;
    if (first) {
      this.walletDeferred.resolve(wallet);
    }
  }

  setRpcHelper(rpcHelper: RpcHelper): void {
    const first = this.rpcHelper === null;
    this.rpcHelper = rpcHelper;
    if (first) {
      this.rpcHelperDeferred.resolve(rpcHelper);
    }
  }

  async ensureDisplay(): Promise<void> {
    const [wallet, config] = await Promise.all([
      this.getWallet(),
      this.configProvider.getConfig(),
    ]);
    // requestDisplay increments nested display depth when a session is already
    // open (SignHelper withDisplay). Release immediately so depth does not leak
    // and block host hide after the outer eth_sendTransaction completes.
    // Visibility is still held by SignHelper / host rpcAccessCount.
    const session = await wallet.requestDisplay(config.displayCeremonySize);
    session.release();
  }

  async hideDisplay(): Promise<void> {
    const wallet = await this.getWallet();
    try {
      await wallet.requestHide();
    } catch {
      // Already hidden or host ignored — do not fail the caller.
    }
  }
}
