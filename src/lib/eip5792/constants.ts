/** EIP-5792 `wallet_sendCalls` version this wallet accepts and returns. */
export const WALLET_CALLS_VERSION = "2.0.0";

/** Upper bound for one `wallet_sendCalls` batch. Above this is error 5740. */
export const MAX_CALLS_PER_BUNDLE = 16;

/** How long `wallet_getCallsStatus` remembers a submitted bundle id. */
export const CALL_BUNDLE_TTL_MS = 24 * 60 * 60 * 1000;

/** How long an id is held before the relayer accepts the batch. */
export const CALL_RESERVATION_TTL_MS = 2 * 60 * 1000;

export const CALL_BUNDLE_KEY_PREFIX = "ows.calls.v1.";

/** EIP-1193 unauthorized. */
export const RPC_ERROR_UNAUTHORIZED = 4100;

/** Capability was not marked optional. */
export const RPC_ERROR_UNSUPPORTED_CAPABILITY = 5700;

/** `chainId` is not an enabled relayer chain. */
export const RPC_ERROR_UNSUPPORTED_CHAIN = 5710;

/** This account and origin already submitted this id. */
export const RPC_ERROR_DUPLICATE_ID = 5720;

/** Bundle id is unknown, expired, or belongs to another origin. */
export const RPC_ERROR_UNKNOWN_BUNDLE_ID = 5730;

/** More calls than {@link MAX_CALLS_PER_BUNDLE}. */
export const RPC_ERROR_BUNDLE_TOO_LARGE = 5740;

/** ERC-20 Transfer(address,address,uint256). */
export const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
