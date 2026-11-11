import {
  idbGetString,
  idbRemoveString,
  idbSetString,
} from "../../utils/idbStringStore";
import {
  CALL_BUNDLE_KEY_PREFIX,
  CALL_BUNDLE_TTL_MS,
  CALL_RESERVATION_TTL_MS,
} from "../../eip5792/constants";
import type { ICallsReceipt } from "../../eip5792/receipt";

export interface IStoredCall {
  to: string;
  data: string;
  value: string;
}

export interface IStoredCallBundle {
  id: string;
  origin: string;
  account: string;
  chainId: string;
  relayerUrl: string;
  /** Absent while the id is reserved and the relayer has not accepted. */
  relayerTransactionId?: string;
  calls: IStoredCall[];
  feeToken: string;
  feeCollector: string;
  atomic: true;
  createdAt: number;
  terminalStatus?: number;
  receipt?: ICallsReceipt;
}

export interface ICallBundleKv {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const idbKv: ICallBundleKv = {
  get: idbGetString,
  set: idbSetString,
  remove: idbRemoveString,
};

export function callBundleKey(
  origin: string,
  account: string,
  id: string,
): string {
  return `${CALL_BUNDLE_KEY_PREFIX}${encodeURIComponent(origin)}/${account.toLowerCase()}/${encodeURIComponent(id)}`;
}

/**
 * Bundle ids for `wallet_getCallsStatus`, scoped to the requesting origin and
 * account. A reservation (no task id) lasts {@link CALL_RESERVATION_TTL_MS}.
 * A submitted row lasts {@link CALL_BUNDLE_TTL_MS}. Expired reads delete the row.
 */
export class CallBundleRepository {
  constructor(
    private readonly kv: ICallBundleKv = idbKv,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async get(
    origin: string,
    account: string,
    id: string,
  ): Promise<IStoredCallBundle | null> {
    const key = callBundleKey(origin, account, id);
    const raw = await this.kv.get(key);
    if (!raw) return null;
    let parsed: IStoredCallBundle;
    try {
      parsed = JSON.parse(raw) as IStoredCallBundle;
    } catch {
      await this.kv.remove(key);
      return null;
    }
    const ttl = parsed.relayerTransactionId
      ? CALL_BUNDLE_TTL_MS
      : CALL_RESERVATION_TTL_MS;
    if (this.now() - parsed.createdAt > ttl) {
      await this.kv.remove(key);
      return null;
    }
    return parsed;
  }

  async put(bundle: IStoredCallBundle): Promise<void> {
    const key = callBundleKey(bundle.origin, bundle.account, bundle.id);
    await this.kv.set(key, JSON.stringify(bundle));
  }

  async remove(origin: string, account: string, id: string): Promise<void> {
    await this.kv.remove(callBundleKey(origin, account, id));
  }
}
