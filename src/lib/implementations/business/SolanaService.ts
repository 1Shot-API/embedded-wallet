import { toKitPartialSigner } from "@1shotapi/ows-signer-utils";
import type { SolanaAccountAddress } from "@1shotapi/ows-types";
import {
  address,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Blockhash,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";

import type {
  ISolanaSendParams,
  ISolanaSendResult,
  ISolanaService,
} from "../../interfaces/business/ISolanaService";
import type { ISolanaRpc } from "../../interfaces/data/ISolanaRpc";
import type { IOWSProvider } from "../../interfaces/utils/IOWSProvider";
import {
  makeSolanaLamports,
  type SolanaLamports,
} from "../../types/primitives/SolanaLamports";

/**
 * Typical base fee for a simple legacy transfer (5000 lamports per signature).
 * Used only for UI fee display / insufficient-balance checks before build.
 */
const ESTIMATED_TRANSFER_FEE_LAMPORTS = 5_000n;

/**
 * In-wallet Solana balance + native SOL send via Alchemy JSON-RPC and Kit
 * system-program transfer, signed by the Signing Layer.
 */
export class SolanaService implements ISolanaService {
  constructor(
    protected readonly solanaRpc: ISolanaRpc,
    protected readonly owsProvider: IOWSProvider,
  ) {}

  getBalance(
    chainId: ISolanaSendParams["chainId"],
    address: SolanaAccountAddress,
  ): Promise<SolanaLamports> {
    return this.solanaRpc.getBalance(chainId, address);
  }

  async send(params: ISolanaSendParams): Promise<ISolanaSendResult> {
    const balance = await this.solanaRpc.getBalance(params.chainId, params.from);
    const feeLamports = makeSolanaLamports(ESTIMATED_TRANSFER_FEE_LAMPORTS);
    if (balance < params.amountLamports + feeLamports) {
      throw new Error("Insufficient SOL for amount and network fee");
    }

    const signer = await this.owsProvider.getSigner();
    const kitSigner = await toKitPartialSigner(signer, {
      accountAddress: params.from,
    });

    const { blockhash, lastValidBlockHeight } =
      await this.solanaRpc.getLatestBlockhash(params.chainId);

    const transfer = getTransferSolInstruction({
      source: kitSigner,
      destination: address(params.to),
      amount: params.amountLamports,
    });

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
      (m) => appendTransactionMessageInstructions([transfer], m),
    );

    const signed = await signTransactionMessageWithSigners(message);
    const wire = getBase64EncodedWireTransaction(signed);

    const signature = await this.solanaRpc.sendRawTransaction(
      params.chainId,
      wire,
    );

    return { signature, feeLamports };
  }
}
