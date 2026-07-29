import { pushModal } from "../wallet/pushModal";
import type { IOnrampOpenRequest } from "./onrampTypes";

/** Open the shared fullscreen Circle onramp (Buy + host `onramp` RPC). */
export function openOnramp(request: IOnrampOpenRequest): Promise<void> {
  return pushModal<void>(({ id, resolve, reject }) => ({
    id,
    kind: "onramp",
    request,
    resolve,
    reject,
  }));
}
