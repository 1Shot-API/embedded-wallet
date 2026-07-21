import {
  prepareEvmTransaction,
  type OWSSigner,
  type SignHelperChainRpc,
} from "@1shotapi/ows-signer-utils";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import {
  EVMTransactionHash,
  HexString,
  OwsInvalidParamsError,
  RelayerTransactionId,
  type EVMAccountAddress,
  type EVMChainId,
  type UriString,
} from "@1shotapi/ows-types";
import type {
  IOneshotRelayerRepository,
  ISendTransactionResult,
} from "../../interfaces/data/IOneshotRelayerRepository";
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";

const ZERO_VALUE = HexString("0x0");
const EMPTY_DATA = HexString("0x");

export type OneshotRelayerRepositoryOptions = {
  blockchain: IBlockchainProvider;
  getSigner: () => OWSSigner;
  getChainRpc: () => SignHelperChainRpc;
};

/**
 * Interim submit path: prepare → passkey sign → eth_sendRawTransaction.
 * Returns a placeholder relayer id until the public relayer is wired.
 * {@link IConfigProvider} supplies the relayer base URL for that future path.
 */
export class OneshotRelayerRepository implements IOneshotRelayerRepository {
  constructor(
    private readonly options: OneshotRelayerRepositoryOptions,
    private readonly configProvider: IConfigProvider,
  ) {}

  async sendTransaction(
    chainId: EVMChainId,
    contractAddress: EVMAccountAddress,
    transactionData: HexString,
    value?: bigint,
    _options?: { webhookDestination?: UriString },
  ): Promise<ISendTransactionResult> {
    void _options;
    // Resolve env now so host→relayer mapping is exercised on every send;
    // used when this path switches to the public relayer API.
    await this.configProvider.getConfig();

    const signer = this.options.getSigner();
    const chainRpc = this.options.getChainRpc();
    const active = chainRpc.getChainId();
    if (active !== chainId) {
      throw new OwsInvalidParamsError(
        `sendTransaction chainId ${chainId} does not match active chain ${active}`,
      );
    }

    const from =
      signer.getCachedAddress?.() ?? (await signer.evm.getAccountAddress());
    const valueHex =
      value === undefined || value === 0n
        ? ZERO_VALUE
        : HexString(`0x${value.toString(16)}` as `0x${string}`);
    const data = transactionData || EMPTY_DATA;

    const prepared = await prepareEvmTransaction(chainRpc, from, {
      from,
      to: contractAddress,
      data,
      value: valueHex,
      chainId,
    });
    const signed = await signer.evm.signTransaction(prepared);

    const client = this.options.blockchain.getPublicClient(chainId);
    const hash = await client.request({
      method: "eth_sendRawTransaction",
      params: [signed],
    });
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      throw new OwsInvalidParamsError(
        "eth_sendRawTransaction returned an invalid transaction hash",
      );
    }

    return {
      relayerTransactionId: RelayerTransactionId(
        `interim-${hash.slice(2, 18)}`,
      ),
      transactionHash: EVMTransactionHash(hash as `0x${string}`),
    };
  }
}
