import { toKitPartialSigner } from "@1shotapi/ows-signer-utils";
import {
  ConversionUtils,
  type EVMChainId,
  type SolanaAccountAddress,
  type SolanaChainId,
  type TransactionHash,
  type UriString,
} from "@1shotapi/ows-types";
import {
  address,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Blockhash,
  type Instruction,
} from "@solana/kit";

import type {
  ICctpBridgeResult,
  ICctpPollProgress,
} from "../../interfaces/business/IBridgeService";
import type {
  ISolanaBridgeService,
  ISolanaCctpBridgeQuote,
  ISolanaCctpQuoteParams,
} from "../../interfaces/business/ISolanaBridgeService";
import type { ICCTPUtils } from "../../interfaces/business/utils/ICCTPUtils";
import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import type {
  ICctpInFlightBurn,
  ICircleRepository,
} from "../../interfaces/data/ICircleRepository";
import type { IKnownAssetRepository } from "../../interfaces/data/IKnownAssetRepository";
import type { ISolanaRpc } from "../../interfaces/data/ISolanaRpc";
import type { IOWSProvider } from "../../interfaces/utils/IOWSProvider";
import type { ECircleDomainId } from "../../types/enum/ECircleDomainId";

const POLL_MS = 3000;
const MAX_POLL_ATTEMPTS = 400;

/**
 * Solana → EVM CCTP via TokenMessengerMinterV2 + Iris Forwarding.
 * User pays SOL for the burn tx; no EIP-7710 relayer.
 */
export class SolanaBridgeService implements ISolanaBridgeService {
  constructor(
    protected readonly chainRepository: IChainRepository,
    protected readonly knownAssetRepository: IKnownAssetRepository,
    protected readonly circleRepository: ICircleRepository,
    protected readonly cctpUtils: ICCTPUtils,
    protected readonly solanaRpc: ISolanaRpc,
    protected readonly owsProvider: IOWSProvider,
  ) {}

  async listDestinations(sourceChainId: SolanaChainId) {
    const source = await this.requireSolanaSource(sourceChainId);
    const chains = await this.chainRepository.list();
    return this.cctpUtils
      .listDestinations(chains, source)
      .filter((c) => !this.cctpUtils.isSolanaRoute(c.chainId));
  }

  async quote(params: ISolanaCctpQuoteParams): Promise<ISolanaCctpBridgeQuote> {
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

    return {
      sourceChainId: params.sourceChainId,
      destChainId: params.destChainId,
      amountAtoms: params.amountAtoms,
      speed: params.speed,
      owner: params.owner,
      mintRecipient: params.mintRecipient,
      mint: params.mint,
      burnAta: params.burnAta,
      sourceUsdc,
      destChain: dest,
      minFinalityThreshold: fees.minFinalityThreshold,
      forwardFee: fees.forwardFee,
      protocolFee: fees.protocolFee,
      maxFee: fees.maxFee,
      totalBurn: fees.totalBurn,
      netReceivedAtoms: params.amountAtoms,
    };
  }

  async execute(
    quote: ISolanaCctpBridgeQuote,
    onProgress?: (progress: ICctpPollProgress) => void,
  ): Promise<ICctpBridgeResult> {
    const { sourceRoute, destRoute } = await this.requireRoute(
      quote.sourceChainId,
      quote.destChainId,
    );

    const fees = await this.fetchBurnFees(
      sourceRoute.irisBaseUrl,
      sourceRoute.domain,
      destRoute.domain,
      quote.speed,
      quote.amountAtoms,
    );

    const signer = await this.owsProvider.getSigner();
    const kitSigner = await toKitPartialSigner(signer, {
      accountAddress: quote.owner,
    });

    const mintRecipient = ConversionUtils.addressToSolanaPubkeyBytes(
      quote.mintRecipient,
    );

    const { instruction, messageSentSigner } =
      await this.cctpUtils.buildSolanaDepositForBurnWithHook({
        owner: kitSigner,
        ownerAddress: address(quote.owner) as Address,
        usdcMint: address(quote.mint) as Address,
        burnTokenAccount: address(quote.burnAta) as Address,
        destinationDomain: destRoute.domain,
        mintRecipient,
        totalBurn: fees.totalBurn,
        maxFee: fees.maxFee,
        minFinalityThreshold: fees.minFinalityThreshold,
      });

    const { blockhash, lastValidBlockHeight } =
      await this.solanaRpc.getLatestBlockhash(quote.sourceChainId);

    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(kitSigner, m),
      (m) =>
        setTransactionMessageLifetimeUsingBlockhash(
          {
            blockhash: blockhash as Blockhash,
            lastValidBlockHeight,
          },
          m,
        ),
      (m) =>
        appendTransactionMessageInstructions(
          [instruction as Instruction],
          m,
        ),
    );

    void messageSentSigner;

    const signed = await signTransactionMessageWithSigners(message);
    const wire = getBase64EncodedWireTransaction(signed);
    const burnTxHash = await this.solanaRpc.sendRawTransaction(
      quote.sourceChainId,
      wire,
    );

    const inFlight: ICctpInFlightBurn = {
      burnTxHash,
      sourceDomain: sourceRoute.domain,
      sourceChainId: quote.sourceChainId,
      destChainId: quote.destChainId,
      amountAtoms: quote.amountAtoms,
      address: quote.owner,
    };
    this.circleRepository.saveInFlight(inFlight);
    onProgress?.({ burnTxHash });

    const forwardTxHash = await this.pollUntilForwarded(inFlight, onProgress);
    return { burnTxHash, forwardTxHash };
  }

  async resume(
    owner: SolanaAccountAddress,
  ): Promise<ICctpInFlightBurn | null> {
    return this.circleRepository.loadInFlight(owner);
  }

  async pollUntilForwarded(
    inFlight: ICctpInFlightBurn,
    onProgress?: (progress: ICctpPollProgress) => void,
  ): Promise<TransactionHash> {
    const sourceRoute = this.cctpUtils.requireRoute(inFlight.sourceChainId);
    onProgress?.({ burnTxHash: inFlight.burnTxHash });

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i += 1) {
      const message = await this.circleRepository.getMessageByBurnTx(
        sourceRoute.irisBaseUrl,
        inFlight.sourceDomain,
        inFlight.burnTxHash,
      );
      const hash = message?.forwardTxHash;
      if (hash) {
        onProgress?.({
          burnTxHash: inFlight.burnTxHash,
          forwardTxHash: hash,
        });
        this.circleRepository.clearInFlight(inFlight.address);
        return hash;
      }
      await sleep(POLL_MS);
    }

    throw new Error("Timed out waiting for Circle to mint on the destination");
  }

  private async fetchBurnFees(
    irisBaseUrl: UriString,
    sourceDomain: ECircleDomainId,
    destDomain: ECircleDomainId,
    speed: ISolanaCctpQuoteParams["speed"],
    amountAtoms: bigint,
  ) {
    const rows = await this.circleRepository.getForwardingFees(
      irisBaseUrl,
      sourceDomain,
      destDomain,
    );
    const minFinalityThreshold =
      this.cctpUtils.finalityThresholdForSpeed(speed);
    const row = this.cctpUtils.pickFeeForThreshold(rows, minFinalityThreshold);
    return {
      minFinalityThreshold,
      ...this.cctpUtils.computeBurnFees(amountAtoms, row),
    };
  }

  private async requireSolanaSource(chainId: SolanaChainId) {
    const chain = await this.chainRepository.get(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    if (!this.cctpUtils.getRoute(chainId)) {
      throw new Error(`Chain ${chainId} is not a CCTP Solana source`);
    }
    return chain;
  }

  private async requireRoute(
    sourceChainId: SolanaChainId,
    destChainId: EVMChainId,
  ) {
    const source = await this.requireSolanaSource(sourceChainId);
    const dest = await this.chainRepository.get(destChainId);
    if (!dest) {
      throw new Error(`Unsupported destination chain: ${destChainId}`);
    }
    if (!this.cctpUtils.isValidDestination(source, dest)) {
      throw new Error(
        "Destination must be a same-network CCTP EVM chain",
      );
    }
    const sourceUsdc =
      await this.knownAssetRepository.getCctpBridgeAsset(sourceChainId);
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
