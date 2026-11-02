import {
  Base64String,
  ConversionUtils,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";
import {
  address,
  getBase64EncodedWireTransaction,
  getCompiledTransactionMessageDecoder,
  type Address,
  type SignatureBytes,
  type Transaction,
  type TransactionMessageBytes,
} from "@solana/kit";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";

/** Reject consent UI for oversized instruction lists. */
export const SOLANA_TX_MAX_INSTRUCTIONS = 64;

/** Cap Wallet Standard `signTransaction` batch size. */
export const SOLANA_TX_MAX_BATCH = 5;

const SYSTEM_TRANSFER_DISCRIMINATOR = 2;
const SYSTEM_ADVANCE_NONCE_DISCRIMINATOR = 4;

export type ESolanaTxInstructionKind = "transferSol" | "generic";

export interface ISolanaTxInstructionSummary {
  kind: ESolanaTxInstructionKind;
  /** Human line for the consent sheet. */
  label: string;
  /** Present when `kind === "transferSol"`. */
  destination?: SolanaAccountAddress;
  lamports?: bigint;
}

export interface ISolanaTxSummary {
  feePayer: SolanaAccountAddress;
  requiredSigners: readonly SolanaAccountAddress[];
  instructionCount: number;
  instructions: readonly ISolanaTxInstructionSummary[];
  /** Non-blocking: durable nonce AdvanceNonce detected. */
  hasDurableNonce: boolean;
}

type INormalizedInstruction = {
  programAddressIndex: number;
  accountIndices?: readonly number[];
  data?: Uint8Array;
};

export class SolanaTxUtils {
  /**
   * Decode compiled message bytes into a consent summary. Throws on empty /
   * undecodable payloads.
   */
  summarize(messageBytes: Uint8Array): ISolanaTxSummary {
    if (messageBytes.length === 0) {
      throw new Error("Solana transaction message is empty");
    }

    const compiled =
      getCompiledTransactionMessageDecoder().decode(messageBytes);
    const feePayer = SolanaAccountAddress(compiled.staticAccounts[0]!);
    const numSigners = compiled.header.numSignerAccounts;
    const requiredSigners = compiled.staticAccounts
      .slice(0, numSigners)
      .map((key) => SolanaAccountAddress(key));

    const instructions: ISolanaTxInstructionSummary[] = [];
    let hasDurableNonce = false;

    if ((compiled as { version?: unknown }).version === 1) {
      const count =
        (compiled as { numInstructions?: number }).numInstructions ?? 0;
      instructions.push({
        kind: "generic",
        label: `Versioned (v1) transaction · ${count} instruction(s)`,
      });
    } else {
      for (const ix of normalizeLegacyOrV0Instructions(compiled as unknown)) {
        const program = compiled.staticAccounts[ix.programAddressIndex];
        if (!program) {
          instructions.push({
            kind: "generic",
            label: "Unknown program instruction",
          });
          continue;
        }

        const data = ix.data ?? new Uint8Array();
        const discriminator =
          data.length >= 4 ? readU32Le(data, 0) : undefined;

        if (
          program === SYSTEM_PROGRAM_ADDRESS &&
          discriminator === SYSTEM_ADVANCE_NONCE_DISCRIMINATOR
        ) {
          hasDurableNonce = true;
        }

        if (
          program === SYSTEM_PROGRAM_ADDRESS &&
          discriminator === SYSTEM_TRANSFER_DISCRIMINATOR &&
          data.length >= 12 &&
          ix.accountIndices &&
          ix.accountIndices.length >= 2
        ) {
          const destIndex = ix.accountIndices[1]!;
          const destination = SolanaAccountAddress(
            compiled.staticAccounts[destIndex]!,
          );
          const lamports = readU64Le(data, 4);
          instructions.push({
            kind: "transferSol",
            label: `Transfer ${formatSol(lamports)} SOL → ${shortAddress(destination)}`,
            destination,
            lamports,
          });
          continue;
        }

        instructions.push({
          kind: "generic",
          label: `Program ${shortAddress(program)} · ${(ix.accountIndices?.length ?? 0)} accounts`,
        });
      }
    }

    return {
      feePayer,
      requiredSigners,
      instructionCount: instructions.length,
      instructions,
      hasDurableNonce,
    };
  }

  /**
   * Hard guards before showing consent. Throws with a user-facing message.
   */
  assertSignable(
    summary: ISolanaTxSummary,
    userAddress: SolanaAccountAddress,
  ): void {
    if (summary.instructionCount > SOLANA_TX_MAX_INSTRUCTIONS) {
      throw new Error(
        `Transaction has ${summary.instructionCount} instructions (max ${SOLANA_TX_MAX_INSTRUCTIONS})`,
      );
    }
    if (summary.feePayer !== userAddress) {
      throw new Error(
        `Fee payer ${shortAddress(summary.feePayer)} is not your account`,
      );
    }
    const extra = summary.requiredSigners.filter((s) => s !== userAddress);
    if (extra.length > 0) {
      throw new Error(
        `Transaction requires additional signers (${extra.map(shortAddress).join(", ")})`,
      );
    }
  }

  /**
   * Build a base64 wire transaction from message bytes + optional user
   * signature (null slots for unsigned simulation).
   */
  buildWireBase64(
    messageBytes: Uint8Array,
    userAddress: SolanaAccountAddress,
    signatureBytes: Uint8Array | null,
  ): string {
    const compiled =
      getCompiledTransactionMessageDecoder().decode(messageBytes);
    const numSigners = compiled.header.numSignerAccounts;
    const signatures: Record<Address, SignatureBytes | null> = {};
    const userKey = address(userAddress);

    for (let i = 0; i < numSigners; i++) {
      const key = compiled.staticAccounts[i]!;
      if (key === userKey && signatureBytes) {
        signatures[key] = signatureBytes as SignatureBytes;
      } else {
        signatures[key] = null;
      }
    }

    const transaction: Transaction = {
      messageBytes: messageBytes as unknown as TransactionMessageBytes,
      signatures,
    };
    return getBase64EncodedWireTransaction(transaction);
  }

  /** Decode Branding wire base64 message payload to bytes. */
  messageBytesFromBase64(encoded: string): Uint8Array {
    return ConversionUtils.base64ToBytes(Base64String(encoded));
  }
}

function normalizeLegacyOrV0Instructions(
  compiled: unknown,
): INormalizedInstruction[] {
  const message = compiled as {
    instructions?: ReadonlyArray<{
      programAddressIndex: number;
      accountIndices?: readonly number[];
      data?: ArrayLike<number>;
    }>;
  };

  return (message.instructions ?? []).map((ix) => ({
    programAddressIndex: ix.programAddressIndex,
    accountIndices: ix.accountIndices ? [...ix.accountIndices] : undefined,
    data: ix.data ? new Uint8Array(ix.data) : undefined,
  }));
}

function readU32Le(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

function readU64Le(bytes: Uint8Array, offset: number): bigint {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(offset, true);
}

function formatSol(lamports: bigint): string {
  const whole = lamports / 1_000_000_000n;
  const frac = lamports % 1_000_000_000n;
  if (frac === 0n) {
    return whole.toString();
  }
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function shortAddress(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
