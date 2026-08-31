import type {
  EVMAccountAddress,
  EVMChainId,
} from "@1shotapi/ows-types";
import type { IChainRepository } from "../../interfaces/data/IChainRepository";
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
import type { TokenAmount } from "../../types/primitives";

export type TransactionServiceOptions = {
  chainRepository: IChainRepository;
  relayerRepository: IOneshotRelayerRepository;
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
    preferredToken?: EVMAccountAddress,
  ): Promise<IPaymentQuote> {
    return this.options.transactionUtils.quotePayment(
      chainId,
      owner,
      preferredToken,
    );
  }

  async sendTransaction(
    chainId: EVMChainId,
    work: ITransactionWork,
    options?: {
      paymentToken?: EVMAccountAddress;
      feeAtoms?: TokenAmount;
      authorizationList?: IRelayerAuthorizationEntry[];
    },
  ): Promise<ISendTransactionResult> {
    const chain = await this.options.chainRepository.get(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    if (!chain.useRelayer) {
      return this.options.relayerRepository.broadcastRawTransaction(
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
      authorizationList: options.authorizationList,
      relayerUrl: chain.relayerUrl,
    });
  }
}
