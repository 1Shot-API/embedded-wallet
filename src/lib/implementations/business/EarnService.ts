import { erc20Abi } from "viem";
import {
  type EVMAccountAddress,
  type EVMChainId,
  type EVMContractAddress,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import type { IKnownAssetRepository } from "../../interfaces/data/IKnownAssetRepository";
import type { ITransactionUtils } from "../../interfaces/business/utils/ITransactionUtils";
import type { IEarnUtils } from "../../interfaces/business/utils/IEarnUtils";
import type {
  IEarnPayment,
  IEarnPosition,
  IEarnQuote,
  IEarnQuoteParams,
  IEarnResult,
  IEarnService,
} from "../../interfaces/business/IEarnService";

type EarnMode = "deposit" | "withdraw";

/**
 * Arc USDC Earn via pinned Morpho ERC-4626 vault + EIP-7710 relayer.
 */
export class EarnService implements IEarnService {
  constructor(
    protected readonly chainRepository: IChainRepository,
    protected readonly knownAssetRepository: IKnownAssetRepository,
    protected readonly transactionUtils: ITransactionUtils,
    protected readonly earnUtils: IEarnUtils,
    protected readonly blockchain: IBlockchainProvider,
  ) {}

  async isEarnSupported(
    chainId: EVMChainId,
    usdcAddress: EVMContractAddress,
  ): Promise<boolean> {
    const known = await this.knownAssetRepository.getKnownAsset(
      chainId,
      usdcAddress,
    );
    return Boolean(known?.useEarn && known.earnVaultAddress);
  }

  async getPosition(
    chainId: EVMChainId,
    owner: EVMAccountAddress,
  ): Promise<IEarnPosition> {
    const { vaultAddress, vaultName, currentApy } =
      await this.requireVault(chainId);
    const client = this.blockchain.getPublicClient(chainId);
    const shares = await client.readContract({
      address: vaultAddress,
      abi: this.earnUtils.erc4626Abi,
      functionName: "balanceOf",
      args: [owner],
    });
    const assets =
      shares === 0n
        ? 0n
        : await client.readContract({
            address: vaultAddress,
            abi: this.earnUtils.erc4626Abi,
            functionName: "convertToAssets",
            args: [shares],
          });
    return {
      chainId,
      vaultAddress,
      vaultName,
      shares,
      assets,
      currentApy,
    };
  }

  async quoteDeposit(params: IEarnQuoteParams): Promise<IEarnQuote> {
    if (params.amountAtoms <= 0n) {
      throw new Error("Deposit amount must be greater than zero");
    }
    const { usdc, vaultAddress, vaultName, currentApy } =
      await this.requireUsdcVault(params.chainId);
    const client = this.blockchain.getPublicClient(params.chainId);
    const [sharesAtoms, usdcAllowance] = await Promise.all([
      client.readContract({
        address: vaultAddress,
        abi: this.earnUtils.erc4626Abi,
        functionName: "previewDeposit",
        args: [params.amountAtoms],
      }),
      client.readContract({
        address: usdc.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [params.owner, vaultAddress],
      }),
    ]);
    const relayerWork = this.earnUtils.buildDepositWork({
      usdcAddress: usdc.address,
      vaultAddress,
      owner: params.owner,
      amountAtoms: params.amountAtoms,
      usdcAllowance,
    });
    const paymentQuote = await this.transactionUtils.quotePayment(
      params.chainId,
      params.owner,
      relayerWork,
      usdc.address,
    );
    return {
      chainId: params.chainId,
      owner: params.owner,
      amountAtoms: params.amountAtoms,
      usdc,
      vaultAddress,
      vaultName,
      sharesAtoms,
      currentApy,
      paymentQuote,
      relayerWork,
    };
  }

  async quoteWithdraw(params: IEarnQuoteParams): Promise<IEarnQuote> {
    if (params.amountAtoms <= 0n) {
      throw new Error("Withdraw amount must be greater than zero");
    }
    const { usdc, vaultAddress, vaultName, currentApy } =
      await this.requireUsdcVault(params.chainId);
    const client = this.blockchain.getPublicClient(params.chainId);
    const maxWithdraw = await client.readContract({
      address: vaultAddress,
      abi: this.earnUtils.erc4626Abi,
      functionName: "maxWithdraw",
      args: [params.owner],
    });
    if (params.amountAtoms > maxWithdraw) {
      throw new Error("Insufficient earning balance for this withdrawal");
    }
    const sharesAtoms = await client.readContract({
      address: vaultAddress,
      abi: this.earnUtils.erc4626Abi,
      functionName: "previewWithdraw",
      args: [params.amountAtoms],
    });
    const relayerWork = this.earnUtils.buildWithdrawWork({
      vaultAddress,
      owner: params.owner,
      amountAtoms: params.amountAtoms,
    });
    const paymentQuote = await this.transactionUtils.quotePayment(
      params.chainId,
      params.owner,
      relayerWork,
      usdc.address,
    );
    return {
      chainId: params.chainId,
      owner: params.owner,
      amountAtoms: params.amountAtoms,
      usdc,
      vaultAddress,
      vaultName,
      sharesAtoms,
      currentApy,
      paymentQuote,
      relayerWork,
    };
  }

  async deposit(
    quote: IEarnQuote,
    payment: IEarnPayment,
  ): Promise<IEarnResult> {
    return this.execute("deposit", quote, payment);
  }

  async withdraw(
    quote: IEarnQuote,
    payment: IEarnPayment,
  ): Promise<IEarnResult> {
    return this.execute("withdraw", quote, payment);
  }

  protected async execute(
    mode: EarnMode,
    quote: IEarnQuote,
    payment: IEarnPayment,
  ): Promise<IEarnResult> {
    const chain = await this.chainRepository.get(quote.chainId);
    if (!chain?.useRelayer || !chain.relayerUrl) {
      throw new Error("Earn requires a relayer-enabled Arc chain");
    }

    let work = quote.relayerWork;
    if (mode === "deposit") {
      const client = this.blockchain.getPublicClient(quote.chainId);
      const usdcAllowance = await client.readContract({
        address: quote.usdc.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [quote.owner, quote.vaultAddress],
      });
      work = this.earnUtils.buildDepositWork({
        usdcAddress: quote.usdc.address,
        vaultAddress: quote.vaultAddress,
        owner: quote.owner,
        amountAtoms: quote.amountAtoms,
        usdcAllowance,
      });
    } else {
      work = this.earnUtils.buildWithdrawWork({
        vaultAddress: quote.vaultAddress,
        owner: quote.owner,
        amountAtoms: quote.amountAtoms,
      });
    }

    const submitted = await this.transactionUtils.sendViaRelayer({
      chainId: quote.chainId,
      work,
      paymentToken: payment.paymentToken,
      feeAtoms: payment.feeAtoms,
      ...(payment.paymentChainId
        ? { paymentChainId: payment.paymentChainId }
        : {}),
      relayerUrl: chain.relayerUrl,
      // Earn is Asset Details only — flyout is already open; do not hide after passkey.
      retainDisplayDuringSubmit: true,
    });
    return {
      transactionHash: submitted.transactionHash as EVMTransactionHash,
    };
  }

  protected async requireUsdcVault(chainId: EVMChainId) {
    const usdc = await this.knownAssetRepository.getEarnAsset(chainId);
    if (!usdc?.earnVaultAddress) {
      throw new Error(`No Earn vault configured for chain ${chainId}`);
    }
    return {
      usdc,
      vaultAddress: usdc.earnVaultAddress,
      vaultName: usdc.earnVaultName ?? "Earn vault",
      currentApy: usdc.earnCurrentApy ?? null,
    };
  }

  protected async requireVault(chainId: EVMChainId) {
    const { vaultAddress, vaultName, currentApy } =
      await this.requireUsdcVault(chainId);
    return { vaultAddress, vaultName, currentApy };
  }
}
