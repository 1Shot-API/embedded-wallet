import type { EVMChainId } from "@1shotapi/ows-types";
import type { EChainNetworkType } from "../enum/EChainNetworkType";

/**
 * Catalog entry for a network the Branding Layer can switch to.
 * `relayerUrl` is for future TX submission only — credentials/activity use
 * {@link WalletConfig.relayerBaseUrl}.
 */
export class SupportedChain {
  public constructor(
    public readonly chainId: EVMChainId,
    public readonly networkType: EChainNetworkType,
    /** Origin for public-relayer TX JSON-RPC (no trailing slash). */
    public readonly relayerUrl: string,
    public readonly useRelayer: boolean,
    /** Vite-resolved URL for the chain logo asset. */
    public readonly logoUrl: string,
    public readonly enabled: boolean,
    public readonly rpcUrl: string,
    public readonly label: string,
    /** Base URL for tx/address explorer links (no trailing slash). */
    public readonly blockExplorerUrl: string,
    public readonly cctpBridgeDestination: boolean,
    /** Higher weight sorts above peers within the same network type. */
    public readonly weight: number = 0,
  ) {}

  public txExplorerUrl(transactionHash: string): string {
    return `${this.blockExplorerUrl}/tx/${transactionHash}`;
  }

  public addressExplorerUrl(address: string): string {
    return `${this.blockExplorerUrl}/address/${address}`;
  }
}
