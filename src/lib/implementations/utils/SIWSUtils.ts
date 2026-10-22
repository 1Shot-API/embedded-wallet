import {
  ConversionUtils,
  ISO8601DateTime,
  SOLANA_MAINNET_CHAIN_ID,
  type ISolanaSignInParams,
  type SolanaAccountAddress,
  type SolanaChainId,
} from "@1shotapi/ows-types";

import type { ISiwsFields } from "../../types/domain/SiwsFields";

export interface IResolveSiwsFieldsParams {
  input?: ISolanaSignInParams;
  /** Embedding host hostname (analytics / SIWS domain default). */
  hostDomain: string;
  accountAddress: SolanaAccountAddress;
  /** Session Solana chain when params omit chainId. */
  sessionChainId?: SolanaChainId | null;
}

/**
 * Resolve SIWS fields with wallet defaults, then build the CAIP-122 message
 * text signed via `signer.solana.signMessage`.
 */
export class SIWSUtils {
  resolveFields(params: IResolveSiwsFieldsParams): ISiwsFields {
    const input = params.input ?? {};
    const domainHost = String(input.domain ?? params.hostDomain)
      .replace(/^https?:\/\//, "")
      .split("/")[0]!;
    const address = input.address ?? params.accountAddress;
    const uri = String(input.uri ?? `https://${domainHost}`);
    const version = input.version?.trim() || "1";
    const chainId =
      input.chainId ??
      params.sessionChainId ??
      SOLANA_MAINNET_CHAIN_ID;
    const nonce = input.nonce?.trim() || this.randomSiwsNonce();
    const issuedAt = String(
      input.issuedAt ?? ISO8601DateTime(new Date().toISOString()),
    );

    return {
      domain: domainHost,
      address,
      uri,
      version,
      chainId,
      nonce,
      issuedAt,
      ...(input.statement !== undefined
        ? { statement: input.statement }
        : {}),
      ...(input.expirationTime !== undefined
        ? { expirationTime: String(input.expirationTime) }
        : {}),
      ...(input.notBefore !== undefined
        ? { notBefore: String(input.notBefore) }
        : {}),
      ...(input.requestId !== undefined
        ? { requestId: input.requestId }
        : {}),
      ...(input.resources !== undefined
        ? { resources: input.resources.map(String) }
        : {}),
    };
  }

  /** Wallet Standard / CAIP-122 SIWS message body. */
  buildMessage(fields: ISiwsFields): string {
    const header = `${fields.domain} wants you to sign in with your Solana account:`;
    const lines: string[] = [header, String(fields.address), ""];

    const statement = fields.statement?.trim();
    if (statement) {
      lines.push(statement, "");
    }

    lines.push(`URI: ${fields.uri}`);
    lines.push(`Version: ${fields.version}`);
    lines.push(`Chain ID: ${fields.chainId}`);
    lines.push(`Nonce: ${fields.nonce}`);
    if (fields.issuedAt) {
      lines.push(`Issued At: ${fields.issuedAt}`);
    }
    if (fields.expirationTime) {
      lines.push(`Expiration Time: ${fields.expirationTime}`);
    }
    if (fields.notBefore) {
      lines.push(`Not Before: ${fields.notBefore}`);
    }
    if (fields.requestId) {
      lines.push(`Request ID: ${fields.requestId}`);
    }
    if (fields.resources && fields.resources.length > 0) {
      lines.push("Resources:");
      for (const resource of fields.resources) {
        lines.push(`- ${resource}`);
      }
    }

    return lines.join("\n");
  }

  messageBytes(fields: ISiwsFields): Uint8Array {
    return new TextEncoder().encode(this.buildMessage(fields));
  }

  messageBase64(fields: ISiwsFields) {
    return ConversionUtils.bytesToBase64(this.messageBytes(fields));
  }

  private randomSiwsNonce(length = 16): string {
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    let out = "";
    for (const byte of bytes) {
      out += alphabet[byte % alphabet.length]!;
    }
    return out;
  }
}
