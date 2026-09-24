import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
} from "@1shotapi/ows-types";
import { HexString } from "@1shotapi/ows-types";
import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import type { IEVMRepository } from "../../interfaces/data/IEVMRepository";
import type {
  IOneshotRelayerRepository,
  IRelayerAuthorizationEntry,
  ISendTransactionResult,
} from "../../interfaces/data/IOneshotRelayerRepository";
import type {
  IPaymentQuote,
  ITransactionService,
  ITransactionWork,
} from "../../interfaces/business/ITransactionService";
import type { ITransactionUtils } from "../../interfaces/business/utils/ITransactionUtils";
import type { IRelayerPayment } from "../../types/domain/RelayerPayment";
import type { IRelayerSendUiCallbacks } from "../../types/domain/RelayerSendUi";
import type { IWalletUpgradeStatus } from "../../types/domain/WalletUpgradeStatus";
import type { TokenAmount } from "../../types/primitives";

const EMPTY_CALLDATA = HexString("0x");

export type TransactionServiceOptions = {
  chainRepository: IChainRepository;
  relayerRepository: IOneshotRelayerRepository;
  evmRepository: IEVMRepository;
  /** Shared EIP-7702 / ExactCalldata / relayer submit helpers. */
  transactionUtils: ITransactionUtils;
};

/**
 * Business orchestration for raw and public-relayer (EIP-7710) sends.
 * Relayer plumbing lives in business {@link ITransactionUtils}.
 */
export class TransactionService implements ITransactionService {
  constructor(private readonly options: TransactionServiceOptions) {}

  needsWalletUpgrade(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<boolean> {
    return this.options.transactionUtils.needsWalletUpgrade(chainId, address);
  }

  getWalletUpgradeStatus(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<IWalletUpgradeStatus> {
    return this.options.transactionUtils.getWalletUpgradeStatus(
      chainId,
      address,
    );
  }

  signWalletUpgradeAuthorization(
    chainId: EVMChainId,
  ): Promise<IRelayerAuthorizationEntry> {
    return this.options.transactionUtils.signWalletUpgradeAuthorization(
      chainId,
    );
  }

  quotePayment(
    chainId: EVMChainId,
    owner: EVMAccountAddress,
    work: ITransactionWork | ITransactionWork[],
    preferredToken?: EVMContractAddress,
  ): Promise<IPaymentQuote> {
    return this.options.transactionUtils.quotePayment(
      chainId,
      owner,
      work,
      preferredToken,
    );
  }

  quoteActivation(
    owner: EVMAccountAddress,
    upgradeChainIds: readonly EVMChainId[],
    payment: IRelayerPayment,
  ): Promise<IPaymentQuote> {
    return this.options.transactionUtils.quoteActivation(
      owner,
      upgradeChainIds,
      payment,
    );
  }

  quotePaymentMultichain(
    owner: EVMAccountAddress,
    workByChain: readonly {
      chainId: EVMChainId;
      work: ITransactionWork | ITransactionWork[];
    }[],
    preferredToken?: EVMContractAddress,
  ): Promise<IPaymentQuote> {
    return this.options.transactionUtils.quotePaymentMultichain(
      owner,
      workByChain,
      preferredToken,
    );
  }

  activateDelegations(
    args: {
      upgradeChainIds: readonly EVMChainId[];
      payment: IRelayerPayment;
      feeAtoms: TokenAmount;
    } & IRelayerSendUiCallbacks,
  ): Promise<ISendTransactionResult[]> {
    return this.options.transactionUtils.activateDelegations(args);
  }

  async sendTransaction(
    chainId: EVMChainId,
    work: ITransactionWork,
    options?: {
      paymentToken?: EVMContractAddress;
      feeAtoms?: TokenAmount;
      paymentChainId?: EVMChainId;
      authorizationList?: IRelayerAuthorizationEntry[];
    } & IRelayerSendUiCallbacks,
  ): Promise<ISendTransactionResult> {
    const chain = await this.options.chainRepository.get(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    if (!chain.useRelayer) {
      return this.options.evmRepository.broadcastRawTransaction(
        chainId,
        work.to,
        work.data,
        work.value,
      );
    }

    if (!options?.paymentToken || options.feeAtoms === undefined) {
      throw new Error(
        "Relayer sends require paymentToken and feeAtoms from the confirm UI",
      );
    }

    return this.options.transactionUtils.sendViaRelayer({
      chainId,
      work,
      paymentToken: options.paymentToken,
      feeAtoms: options.feeAtoms,
      ...(options.paymentChainId
        ? { paymentChainId: options.paymentChainId }
        : {}),
      authorizationList: options.authorizationList,
      relayerUrl: chain.relayerUrl,
      onFinalFeeRequired: options.onFinalFeeRequired,
      onAwaitingConfirmation: options.onAwaitingConfirmation,
      retainDisplayDuringSubmit: options.retainDisplayDuringSubmit,
    });
  }

  async sendNativeTransfer(
    chainId: EVMChainId,
    to: EVMAccountAddress,
    value: bigint,
  ): Promise<ISendTransactionResult> {
    const chain = await this.options.chainRepository.get(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    const planned = await this.options.transactionUtils.planNativeTransfer(
      chainId,
      value,
    );
    return this.options.evmRepository.broadcastRawTransaction(
      chainId,
      to,
      EMPTY_CALLDATA,
      planned.value,
      {
        gas: planned.gas,
        maxFeePerGas: planned.maxFeePerGas,
        maxPriorityFeePerGas: planned.maxPriorityFeePerGas,
      },
    );
  }

  estimateNativeTransferFee(chainId: EVMChainId): Promise<{
    gasPrice: bigint;
    maxPriorityFeePerGas: bigint;
    feeAtoms: bigint;
  }> {
    return this.options.transactionUtils.estimateNativeTransferFee(chainId);
  }
}
