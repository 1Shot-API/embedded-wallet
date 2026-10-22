import { toKitPartialSigner } from "@1shotapi/ows-signer-utils";
import {
  SolanaAddressUtils,
  type SolanaAccountAddress,
  type SolanaATAAddress,
  type SolanaMintAddress,
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
import { getTransferSolInstruction } from "@solana-program/system";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";

import type {
  ISolanaEnsureAtaParams,
  ISolanaEnsureAtaResult,
  ISolanaSendParams,
  ISolanaSendResult,
  ISolanaSendSplParams,
  ISolanaSendSplResult,
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
 * Rent-exempt minimum for a classic SPL token account (~0.00203928 SOL).
 * Used for UI estimates; actual rent is determined on-chain by CreateIdempotent.
 */
const ATA_RENT_EXEMPT_LAMPORTS = 2_039_280n;

/** Token-2022 program id (mint owner when Token Extensions). */
const TOKEN_2022_PROGRAM_ADDRESS =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" as Address;

/**
 * In-wallet Solana balance + native SOL / SPL send via Alchemy JSON-RPC and
 * Kit instructions, signed by the Signing Layer.
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

  estimateAtaRentLamports(): SolanaLamports {
    return makeSolanaLamports(ATA_RENT_EXEMPT_LAMPORTS);
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

  async recipientAtaExists(
    chainId: ISolanaEnsureAtaParams["chainId"],
    owner: SolanaAccountAddress,
    mint: SolanaMintAddress,
  ): Promise<{ exists: boolean; ataAddress: SolanaATAAddress }> {
    const tokenProgram = await this.resolveTokenProgram(chainId, mint);
    const ataAddress = await this.deriveAta(owner, mint, tokenProgram);
    const exists = await this.solanaRpc.accountExists(chainId, ataAddress);
    return { exists, ataAddress };
  }

  async ensureAta(
    params: ISolanaEnsureAtaParams,
  ): Promise<ISolanaEnsureAtaResult> {
    const tokenProgram = await this.resolveTokenProgram(
      params.chainId,
      params.mint,
    );
    const ataAddress = await this.deriveAta(
      params.owner,
      params.mint,
      tokenProgram,
    );
    const exists = await this.solanaRpc.accountExists(
      params.chainId,
      ataAddress,
    );
    if (exists) {
      return {
        ataAddress,
        created: false,
        signature: null,
        rentLamports: makeSolanaLamports(0n),
      };
    }

    const rentLamports = this.estimateAtaRentLamports();
    const feeLamports = makeSolanaLamports(ESTIMATED_TRANSFER_FEE_LAMPORTS);
    const balance = await this.solanaRpc.getBalance(
      params.chainId,
      params.owner,
    );
    if (balance < rentLamports + feeLamports) {
      throw new Error(
        "Insufficient SOL to create token account (rent + network fee)",
      );
    }

    const signer = await this.owsProvider.getSigner();
    const kitSigner = await toKitPartialSigner(signer, {
      accountAddress: params.owner,
    });

    const { blockhash, lastValidBlockHeight } =
      await this.solanaRpc.getLatestBlockhash(params.chainId);

    const createIx = getCreateAssociatedTokenIdempotentInstruction({
      payer: kitSigner,
      ata: address(ataAddress),
      owner: address(params.owner),
      mint: address(params.mint),
      tokenProgram: tokenProgram,
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
      (m) =>
        appendTransactionMessageInstructions(
          [createIx as Instruction],
          m,
        ),
    );

    const signed = await signTransactionMessageWithSigners(message);
    const wire = getBase64EncodedWireTransaction(signed);
    const signature = await this.solanaRpc.sendRawTransaction(
      params.chainId,
      wire,
    );

    return {
      ataAddress,
      created: true,
      signature,
      rentLamports,
    };
  }

  async sendSpl(params: ISolanaSendSplParams): Promise<ISolanaSendSplResult> {
    const tokenProgram = await this.resolveTokenProgram(
      params.chainId,
      params.mint,
    );
    const sourceAta = await this.deriveAta(
      params.from,
      params.mint,
      tokenProgram,
    );
    const destAta = await this.deriveAta(params.to, params.mint, tokenProgram);
    const destExists = await this.solanaRpc.accountExists(
      params.chainId,
      destAta,
    );

    const rentLamports = destExists
      ? makeSolanaLamports(0n)
      : this.estimateAtaRentLamports();
    const feeLamports = makeSolanaLamports(ESTIMATED_TRANSFER_FEE_LAMPORTS);
    const solBalance = await this.solanaRpc.getBalance(
      params.chainId,
      params.from,
    );
    if (solBalance < rentLamports + feeLamports) {
      throw new Error(
        destExists
          ? "Insufficient SOL for network fee"
          : "Insufficient SOL to create recipient token account (rent + fee)",
      );
    }

    const sourceExists = await this.solanaRpc.accountExists(
      params.chainId,
      sourceAta,
    );
    if (!sourceExists) {
      throw new Error("Sender token account does not exist — add the asset first");
    }

    const { amount: tokenBalance } = await this.solanaRpc.getTokenAccountBalance(
      params.chainId,
      sourceAta,
    );
    if (tokenBalance < params.amount) {
      throw new Error("Insufficient token balance");
    }

    const signer = await this.owsProvider.getSigner();
    const kitSigner = await toKitPartialSigner(signer, {
      accountAddress: params.from,
    });

    const { blockhash, lastValidBlockHeight } =
      await this.solanaRpc.getLatestBlockhash(params.chainId);

    const instructions: Instruction[] = [];
    if (!destExists) {
      instructions.push(
        getCreateAssociatedTokenIdempotentInstruction({
          payer: kitSigner,
          ata: address(destAta),
          owner: address(params.to),
          mint: address(params.mint),
          tokenProgram: tokenProgram,
        }) as Instruction,
      );
    }
    instructions.push(
      getTransferCheckedInstruction(
        {
          source: address(sourceAta),
          mint: address(params.mint),
          destination: address(destAta),
          authority: kitSigner,
          amount: params.amount,
          decimals: params.decimals,
        },
        { programAddress: tokenProgram },
      ) as Instruction,
    );

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
      (m) => appendTransactionMessageInstructions(instructions, m),
    );

    const signed = await signTransactionMessageWithSigners(message);
    const wire = getBase64EncodedWireTransaction(signed);
    const signature = await this.solanaRpc.sendRawTransaction(
      params.chainId,
      wire,
    );

    return {
      signature,
      feeLamports,
      createdRecipientAta: !destExists,
      rentLamports,
    };
  }

  protected async resolveTokenProgram(
    chainId: ISolanaEnsureAtaParams["chainId"],
    mint: SolanaMintAddress,
  ): Promise<Address> {
    const owner = await this.solanaRpc.getMintTokenProgram(chainId, mint);
    const ownerStr = String(owner);
    if (ownerStr === TOKEN_2022_PROGRAM_ADDRESS) {
      return TOKEN_2022_PROGRAM_ADDRESS;
    }
    if (ownerStr === TOKEN_PROGRAM_ADDRESS) {
      return TOKEN_PROGRAM_ADDRESS;
    }
    // Unknown owner — still try classic Token ATA derivation.
    return TOKEN_PROGRAM_ADDRESS;
  }

  protected async deriveAta(
    owner: SolanaAccountAddress,
    mint: SolanaMintAddress,
    tokenProgram: Address,
  ): Promise<SolanaATAAddress> {
    const [ata] = await findAssociatedTokenPda({
      owner: address(owner),
      mint: address(mint),
      tokenProgram,
    });
    return SolanaAddressUtils.asAtaAddress(ata);
  }
}
