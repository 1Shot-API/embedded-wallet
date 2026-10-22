import { pushModal } from "../wallet/pushModal";

import type {
  ISolanaBridgeModalResult,
  ISolanaBridgeOpenRequest,
} from "./solanaBridgeTypes";

/** Open the Solana → EVM CCTP USDC bridge (SPL detail + host `bridge` RPC). */
export function openSolanaBridge(
  request: ISolanaBridgeOpenRequest,
): Promise<ISolanaBridgeModalResult> {
  return pushModal<ISolanaBridgeModalResult>(({ id, resolve, reject }) => ({
    id,
    kind: "solanaBridge",
    request,
    resolve,
    reject,
  }));
}
