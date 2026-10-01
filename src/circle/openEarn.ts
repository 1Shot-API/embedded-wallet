import { pushModal } from "../wallet/pushModal";
import type { IEarnModalResult, IEarnOpenRequest } from "./earnTypes";

/** Open Arc USDC Earn (Asset Details — no host RPC in v1). */
export function openEarn(
  request: IEarnOpenRequest,
): Promise<IEarnModalResult> {
  return pushModal<IEarnModalResult>(({ id, resolve, reject }) => ({
    id,
    kind: "earn",
    request,
    resolve,
    reject,
  }));
}
