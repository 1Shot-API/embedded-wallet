const LIFI_QUOTE_URL = "https://li.quest/v1/quote";
export const LIFI_INTEGRATOR = "1shot-wallet-playground";
export const LIFI_NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

export interface ILifiTokenRef {
  address: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export interface ILifiQuoteEstimate {
  toAmount: string;
  toAmountMin: string;
  approvalAddress: string;
}

export interface ILifiTransactionRequest {
  to: string;
  data: string;
  value?: string;
  chainId: number;
}

export interface ILifiQuote {
  estimate: ILifiQuoteEstimate;
  transactionRequest: ILifiTransactionRequest;
  action: {
    fromToken: ILifiTokenRef;
    toToken: ILifiTokenRef;
    fromAmount: string;
  };
  tool?: string;
}

export interface ILifiQuoteParams {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  slippage?: number;
}

function formatLifiError(status: number, body: unknown): string {
  if (status === 404) {
    return "No swap route found for this pair and amount. Try a different token or chain.";
  }
  if (status === 429) {
    return "LI.FI rate limit reached. Wait a moment and try again.";
  }
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return `LI.FI quote failed (${status}).`;
}

export async function fetchLifiQuote(
  params: ILifiQuoteParams,
): Promise<ILifiQuote> {
  const search = new URLSearchParams({
    fromChain: String(params.fromChain),
    toChain: String(params.toChain),
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    integrator: LIFI_INTEGRATOR,
    slippage: String(params.slippage ?? 0.005),
  });

  const response = await fetch(`${LIFI_QUOTE_URL}?${search.toString()}`);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(formatLifiError(response.status, body));
  }

  const quote = body as ILifiQuote;
  if (!quote?.estimate || !quote?.transactionRequest || !quote?.action) {
    throw new Error("LI.FI returned an unexpected quote shape.");
  }

  return quote;
}
