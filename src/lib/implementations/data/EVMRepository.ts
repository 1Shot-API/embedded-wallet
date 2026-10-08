import { prepareEvmTransaction } from "@1shotapi/ows-signer-utils";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  EVMTransactionHash,
  HexString,
  OwsInvalidParamsError,
  RelayerTransactionId,
  type EVMChainId,
  type EVMContractAddress,
} from "@1shotapi/ows-types";
import type {
  IEVMRepository,
  IEvmGasOverrides,
} from "../../interfaces/data/IEVMRepository";
import type { ISendTransactionResult } from "../../interfaces/data/IOneshotRelayerRepository";
import type { IOWSProvider } from "../../interfaces/utils/IOWSProvider";

const ZERO_VALUE = HexString("0x0");
const EMPTY_DATA = HexString("0x");

/**
 * Prepare + passkey-sign + eth_sendRawTransaction against the active chain RPC.
 */
export class EVMRepository implements IEVMRepository {
  constructor(
    protected readonly blockchain: IBlockchainProvider,
    protected readonly owsProvider: IOWSProvider,
  ) {}

  async broadcastRawTransaction(
    chainId: EVMChainId,
    to: EVMAccountAddress | EVMContractAddress,
    data: HexString,
    value?: bigint,
    gasOverrides?: IEvmGasOverrides,
  ): Promise<ISendTransactionResult> {
    const [signer, chainRpc] = await Promise.all([
      this.owsProvider.getSigner(),
      this.owsProvider.getRpcHelper(),
    ]);
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
    const txData = data || EMPTY_DATA;
    const toHexQuantity = (n: bigint): HexString =>
      HexString(`0x${n.toString(16)}` as `0x${string}`);

    const prepared = await prepareEvmTransaction(chainRpc, from, {
      from,
      // Tx `to` is polymorphic (EOA or contract); EIP-1193 request type uses account brand.
      to: EVMAccountAddress(to),
      data: txData,
      value: valueHex,
      chainId,
      ...(gasOverrides?.gas !== undefined
        ? { gas: toHexQuantity(gasOverrides.gas) }
        : {}),
      ...(gasOverrides?.gasPrice !== undefined
        ? { gasPrice: toHexQuantity(gasOverrides.gasPrice) }
        : {
            ...(gasOverrides?.maxFeePerGas !== undefined
              ? { maxFeePerGas: toHexQuantity(gasOverrides.maxFeePerGas) }
              : {}),
            ...(gasOverrides?.maxPriorityFeePerGas !== undefined
              ? {
                  maxPriorityFeePerGas: toHexQuantity(
                    gasOverrides.maxPriorityFeePerGas,
                  ),
                }
              : {}),
          }),
    });
    const [signed] = await signer.evm.signTransaction([prepared]);
    if (!signed) {
      throw new OwsInvalidParamsError("signTransaction returned no signature");
    }

    const client = this.blockchain.getPublicClient(chainId);
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
      // Interim local id: 0x-prefixed hex slice of the broadcast hash.
      relayerTransactionId: RelayerTransactionId(
        `0x${hash.slice(2, 18)}` as `0x${string}`,
      ),
      transactionHash: EVMTransactionHash(hash as `0x${string}`),
    };
  }
}
