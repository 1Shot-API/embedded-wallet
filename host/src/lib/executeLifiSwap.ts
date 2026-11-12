import type { EIP1193Provider } from "@1shotapi/ows-provider";
import {
  EVMAccountAddress,
  EVMChainId,
  HexString,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import {
  createPublicClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  maxUint256,
  type Address,
  type Hex,
} from "viem";

import { isNativeToken } from "@/constants/swapTokens";

import type { ILifiQuote } from "@/lib/lifiQuote";

export interface IExecuteLifiSwapParams {
  provider: EIP1193Provider;
  account: string;
  quote: ILifiQuote;
}

export interface IExecuteLifiSwapResult {
  approveHash?: EVMTransactionHash;
  swapHash: EVMTransactionHash;
}

async function sendTransaction(
  provider: EIP1193Provider,
  account: string,
  tx: { to: string; data: string; value?: string; chainId: number },
): Promise<EVMTransactionHash> {
  const chainId = EVMChainId(
    `0x${tx.chainId.toString(16)}` as `0x${string}`,
  );

  return (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: EVMAccountAddress(getAddress(account) as `0x${string}`),
        to: EVMAccountAddress(getAddress(tx.to) as `0x${string}`),
        data: HexString(tx.data as Hex),
        value: HexString((tx.value ?? "0x0") as Hex),
        chainId,
      },
    ],
  })) as EVMTransactionHash;
}

async function ensureErc20Allowance(
  provider: EIP1193Provider,
  account: string,
  quote: ILifiQuote,
): Promise<EVMTransactionHash | undefined> {
  const fromToken = quote.action.fromToken.address;
  if (isNativeToken(fromToken)) {
    return undefined;
  }

  const owner = getAddress(account) as Address;
  const token = getAddress(fromToken) as Address;
  const spender = getAddress(quote.estimate.approvalAddress) as Address;
  const required = BigInt(quote.action.fromAmount);

  const client = createPublicClient({
    transport: custom(provider),
  });

  const allowance = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });

  if (allowance >= required) {
    return undefined;
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
  }) as Hex;

  return sendTransaction(provider, account, {
    to: token,
    data,
    value: "0x0",
    chainId: quote.transactionRequest.chainId,
  });
}

export async function executeLifiSwap({
  provider,
  account,
  quote,
}: IExecuteLifiSwapParams): Promise<IExecuteLifiSwapResult> {
  const approveHash = await ensureErc20Allowance(provider, account, quote);
  const swapHash = await sendTransaction(
    provider,
    account,
    quote.transactionRequest,
  );

  return approveHash ? { approveHash, swapHash } : { swapHash };
}
