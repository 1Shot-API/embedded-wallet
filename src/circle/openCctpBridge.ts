import { pushModal } from "../wallet/pushModal";
import type {
  ICctpBridgeModalResult,
  ICctpBridgeOpenRequest,
} from "./cctpBridgeTypes";

/** Open the shared CCTP USDC bridge (Asset Details + host `bridge` RPC). */
export function openCctpBridge(
  request: ICctpBridgeOpenRequest,
): Promise<ICctpBridgeModalResult> {
  return pushModal<ICctpBridgeModalResult>(({ id, resolve, reject }) => ({
    id,
    kind: "cctpBridge",
    request,
    resolve,
    reject,
  }));
}
