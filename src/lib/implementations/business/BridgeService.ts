import {
  EVMTransactionHash,
  UriString,
  type EVMAccountAddress,
  type EVMChainId,
} from "@1shotapi/ows-types";
import { erc20Abi } from "viem";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import type {
  ICctpInFlightBurn,
  ICircleRepository,
} from "../../interfaces/data/ICircleRepository";
import type { IKnownAssetRepository } from "../../interfaces/data/IKnownAssetRepository";
import type { ICCTPUtils } from "../../interfaces/business/utils/ICCTPUtils";
import type { ITransactionUtils } from "../../interfaces/business/utils/ITransactionUtils";
import type {
  IBridgeService,
  ICctpBridgePayment,
  ICctpBridgeQuote,
  ICctpBridgeResult,
  ICctpPollProgress,
  ICctpQuoteParams,
} from "../../interfaces/business/IBridgeService";
import type { ECircleDomainId } from "../../types/enum/ECircleDomainId";

const POLL_MS = 3000;
const MAX_POLL_ATTEMPTS = 400;

/**
 * Quote / execute / resume CCTP V2 USDC burns via Iris + the public relayer.
 * Destination mint is Circle’s Forwarding Service — never `receiveMessage`.
 */
export class BridgeService implements IBridgeService {
  constructor(
    protected readonly chainRepository: IChainRepository,
    protected readonly knownAssetRepository: IKnownAssetRepository,
    protected readonly circleRepository: ICircleRepository,
    protected readonly transactionUtils: ITransactionUtils,
    protected readonly cctpUtils: ICCTPUtils,
    protected readonly blockchain: IBlockchainProvider,
  ) {}

  async listDestinations(sourceChainId: EVMChainId) {
    const source = await this.requireChain(sourceChainId);
    const chains = await this.chainRepository.list();
    return this.cctpUtils.listDestinations(chains, source);
  }

  async quote(params: ICctpQuoteParams): Promise<ICctpBridgeQuote> {
    const { dest, sourceUsdc, sourceRoute, destRoute } =
      await this.requireRoute(params.sourceChainId, params.destChainId);

    if (params.amountAtoms <= 0n) {
      throw new Error("Bridge amount must be greater than zero");
    }

    const fees = await this.fetchBurnFees(
      sourceRoute.irisBaseUrl,
      sourceRoute.domain,
      destRoute.domain,
      params.speed,
      params.amountAtoms,
    );
    const paymentQuote = await this.transactionUtils.quotePayment(
      params.sourceChainId,
      params.owner,
      sourceUsdc.address,
    );
    const burnCalldata = this.cctpUtils.encodeDepositForBurnWithHook({
      totalBurn: fees.totalBurn,
      destDomain: destRoute.domain,
      mintRecipient: params.owner,
      burnToken: sourceUsdc.address,
      maxFee: fees.maxFee,
      minFinalityThreshold: fees.minFinalityThreshold,
    });

    return {
      sourceChainId: params.sourceChainId,
      destChainId: params.destChainId,
      amountAtoms: params.amountAtoms,
      speed: params.speed,
      owner: params.owner,
      sourceUsdc,
      destChain: dest,
      minFinalityThreshold: fees.minFinalityThreshold,
      forwardFee: fees.forwardFee,
      protocolFee: fees.protocolFee,
      maxFee: fees.maxFee,
      totalBurn: fees.totalBurn,
      netReceivedAtoms: params.amountAtoms,
      paymentQuote,
      burnCalldata,
    };
  }

  async execute(
    quote: ICctpBridgeQuote,
    payment: ICctpBridgePayment,
    onProgress?: (progress: ICctpPollProgress) => void,
  ): Promise<ICctpBridgeResult> {
    const { source, sourceUsdc, sourceRoute, destRoute } =
      await this.requireRoute(quote.sourceChainId, quote.destChainId);

    const fees = await this.fetchBurnFees(
      sourceRoute.irisBaseUrl,
      sourceRoute.domain,
      destRoute.domain,
      quote.speed,
      quote.amountAtoms,
    );
    const contracts = this.cctpUtils.getContracts(
      sourceRoute.domain,
      sourceRoute.networkType,
    );
    const allowance = await this.readAllowance(
      quote.sourceChainId,
      sourceUsdc.address,
      quote.owner,
      contracts.tokenMessengerV2,
    );
    const burnData = this.cctpUtils.encodeDepositForBurnWithHook({
      totalBurn: fees.totalBurn,
      destDomain: destRoute.domain,
      mintRecipient: quote.owner,
      burnToken: sourceUsdc.address,
      maxFee: fees.maxFee,
      minFinalityThreshold: fees.minFinalityThreshold,
    });
    const approveData = this.cctpUtils.encodeUsdcApprove(
      contracts.tokenMessengerV2,
      fees.totalBurn,
    );
    const work = this.cctpUtils.buildRelayerWork({
      allowance,
      totalBurn: fees.totalBurn,
      usdcAddress: sourceUsdc.address,
      tokenMessenger: contracts.tokenMessengerV2,
      approveData,
      burnData,
    });

    const submitted = await this.transactionUtils.sendViaRelayer({
      chainId: quote.sourceChainId,
      work,
      paymentToken: payment.paymentToken,
      feeAtoms: payment.feeAtoms,
      relayerUrl: source.relayerUrl,
    });

    const inFlight: ICctpInFlightBurn = {
      burnTxHash: submitted.transactionHash,
      sourceDomain: sourceRoute.domain,
      sourceChainId: quote.sourceChainId,
      destChainId: quote.destChainId,
      amountAtoms: quote.amountAtoms,
      address: quote.owner,
    };
    this.circleRepository.saveInFlight(inFlight);
    onProgress?.({ burnTxHash: submitted.transactionHash });

    const forwardTxHash = await this.pollUntilForwarded(inFlight, onProgress);
    return {
      burnTxHash: submitted.transactionHash,
      forwardTxHash,
    };
  }

  async resume(owner: EVMAccountAddress): Promise<ICctpInFlightBurn | null> {
    return this.circleRepository.loadInFlight(owner);
  }

  async pollUntilForwarded(
    inFlight: ICctpInFlightBurn,
    onProgress?: (progress: ICctpPollProgress) => void,
  ): Promise<EVMTransactionHash> {
    const sourceRoute = this.cctpUtils.requireRoute(
      inFlight.sourceChainId,
    );
    onProgress?.({ burnTxHash: inFlight.burnTxHash });

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i += 1) {
      const message = await this.circleRepository.getMessageByBurnTx(
        sourceRoute.irisBaseUrl,
        inFlight.sourceDomain,
        inFlight.burnTxHash,
      );
      const hash = message?.forwardTxHash;
      if (hash && hash.startsWith("0x") && hash.length >= 66) {
        const forwardTxHash = EVMTransactionHash(hash as `0x${string}`);
        onProgress?.({
          burnTxHash: inFlight.burnTxHash,
          forwardTxHash,
        });
        this.circleRepository.clearInFlight(inFlight.address);
        return forwardTxHash;
      }
      await sleep(POLL_MS);
    }

    throw new Error("Timed out waiting for Circle to mint on the destination");
  }

  private async fetchBurnFees(
    irisBaseUrl: UriString,
    sourceDomain: ECircleDomainId,
    destDomain: ECircleDomainId,
    speed: ICctpQuoteParams["speed"],
    amountAtoms: bigint,
  ) {
    const rows = await this.circleRepository.getForwardingFees(
      irisBaseUrl,
      sourceDomain,
      destDomain,
    );
    const minFinalityThreshold = this.cctpUtils.finalityThresholdForSpeed(speed);
    const row = this.cctpUtils.pickFeeForThreshold(rows, minFinalityThreshold);
    return {
      minFinalityThreshold,
      ...this.cctpUtils.computeBurnFees(amountAtoms, row),
    };
  }

  private async readAllowance(
    chainId: EVMChainId,
    usdc: EVMAccountAddress,
    owner: EVMAccountAddress,
    spender: EVMAccountAddress,
  ): Promise<bigint> {
    const client = this.blockchain.getPublicClient(chainId);
    try {
      return await client.readContract({
        address: usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner, spender],
      });
    } catch {
      return 0n;
    }
  }

  private async requireChain(chainId: EVMChainId) {
    const chain = await this.chainRepository.get(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    if (!chain.useRelayer) {
      throw new Error(`Chain ${chainId} does not support the 1Shot relayer`);
    }
    return chain;
  }

  private async requireRoute(
    sourceChainId: EVMChainId,
    destChainId: EVMChainId,
  ) {
    const source = await this.requireChain(sourceChainId);
    const dest = await this.chainRepository.get(destChainId);
    if (!dest) {
      throw new Error(`Unsupported destination chain: ${destChainId}`);
    }
    if (!this.cctpUtils.isValidDestination(source, dest)) {
      throw new Error(
        "Destination must be a same-network CCTP chain other than the source",
      );
    }
    const sourceUsdc =
      await this.knownAssetRepository.getCctpBridgeAsset(
        sourceChainId,
      );
    if (!sourceUsdc) {
      throw new Error(`No CCTP USDC on ${source.label}`);
    }
    return {
      source,
      dest,
      sourceUsdc,
      sourceRoute: this.cctpUtils.requireRoute(sourceChainId),
      destRoute: this.cctpUtils.requireRoute(destChainId),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
