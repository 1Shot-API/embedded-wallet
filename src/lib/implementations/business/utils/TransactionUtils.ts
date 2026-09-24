import {
  createDelegation,
  getSmartAccountsEnvironment,
  Implementation,
  ScopeType,
  toMetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit";
import { toViemLocalAccount } from "@1shotapi/ows-signer-utils";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  EVMContractAddress,
  EVMTransactionHash,
  type CeremonyUiParams,
  type EVMChainId,
  type HexString,
  type RelayerTransactionId,
} from "@1shotapi/ows-types";
import {
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  parseUnits,
  type Hex,
} from "viem";
import { recoverAuthorizationAddress } from "viem/utils";
import type { LocalAccount } from "viem/accounts";
import type { IChainRepository } from "../../../interfaces/data/IChainRepository";
import type { IDelegationRepository } from "../../../interfaces/data/IDelegationRepository";
import type {
  IOneshotRelayerRepository,
  IRelayer7710Params,
  IRelayerAuthorizationEntry,
  ISendTransactionResult,
} from "../../../interfaces/data/IOneshotRelayerRepository";
import type { ITrackedAssetRepository } from "../../../interfaces/data/ITrackedAssetRepository";
import type {
  IPaymentQuote,
  IPaymentTokenOption,
  ITransactionWork,
} from "../../../interfaces/business/ITransactionService";
import {
  NATIVE_TRANSFER_GAS,
  maxNativeSendable,
  withNativeFeeHeadroom,
  type ITransactionUtils,
} from "../../../interfaces/business/utils/ITransactionUtils";
import type { ITransactionUtils as IPresentationTransactionUtils } from "../../../interfaces/utils/ITransactionUtils";
import type { IOWSProvider } from "../../../interfaces/utils/IOWSProvider";
import type { IPaymentTokenUtils } from "../../../interfaces/business/utils/IPaymentTokenUtils";
import type { IRelayerPayment } from "../../../types/domain/RelayerPayment";
import type { IFinalRelayerFee } from "../../../types/domain/RelayerSendUi";
import type { IWalletUpgradeStatus } from "../../../types/domain/WalletUpgradeStatus";
import { EPasskeyPromptReason } from "../../../types/enum/EPasskeyPromptReason";
import {
  makeTokenAmount,
  tokenAmountFromAtomString,
  type TokenAmount,
} from "../../../types/primitives";
import { idbGetString, idbSetString } from "../../../utils/idbStringStore";
import { withCeremonyUiReason } from "../../../../wallet/ceremonyUiOverrideStore";
import { withCoalescedSignDigest } from "../../../../wallet/withCoalescedSignDigest";
import type { CoalesceSignDigestOptions } from "../../../../wallet/withCoalescedSignDigest";
import {
  loadCachedEvmAddress,
  loadCachedSecp256k1PublicKey,
} from "../../../../storage";
import { styleController } from "../../../../style/styleController";
// Ensure Arc mainnet Smart Accounts env is registered before any kit lookups.
import "../../utils/registerSmartAccountsEnvironments";

const STATELESS_DELEGATOR_IMPL =
  EVMContractAddress("0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B");

/**
 * 65-byte zero signature for `relayer_estimate7710Transaction` unsigned
 * estimates. Valid ECDSA length so the DelegatorEstimateShim's
 * ECDSA.tryRecover pays ecrecover precompile gas (prefer over bytes32(0)).
 */
export const PLACEHOLDER_DELEGATION_SIGNATURE_65_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" as const;

const PLACEHOLDER_AUTH_R =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const PLACEHOLDER_AUTH_S =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

/** IndexedDB key for the client delegation-binding value (not localStorage). */
const DELEGATION_BINDING_IDB_KEY = "oneshot.dbind";
const LEGACY_DELEGATION_SECRET_KEY = "oneshot.delegationSecret";
const POLL_MS = 1000;
const MAX_POLL_ATTEMPTS = 180;
const EMPTY_CALLDATA = "0x" as Hex;
/** Safe no-op call target: empty calldata to the EOA hits the estimate shim
 *  (or StatelessDelegator) fallback and reverts. Zero address accepts it. */
const ACTIVATION_NOOP_TARGET =
  EVMAccountAddress("0x0000000000000000000000000000000000000000");

type ExactCalldataDelegationArgs = {
  smartAccount: Awaited<ReturnType<typeof toMetaMaskSmartAccount>>;
  delegate: EVMAccountAddress;
  target: EVMAccountAddress;
  value: bigint;
  callData: Hex;
  chainIdNumber: number;
};

/** EIP-7702 activation no-op: empty calldata, zero native value. */
type ActivationNoOpDelegationArgs = {
  smartAccount: Awaited<ReturnType<typeof toMetaMaskSmartAccount>>;
  delegate: EVMAccountAddress;
};

export type TransactionUtilsOptions = {
  chainRepository: IChainRepository;
  relayerRepository: IOneshotRelayerRepository;
  trackedAssetRepository: ITrackedAssetRepository;
  paymentTokenUtils: IPaymentTokenUtils;
  blockchain: IBlockchainProvider;
  /** Presentation helpers (host domain for relayer memo). */
  presentationTransactionUtils: IPresentationTransactionUtils;
  owsProvider: IOWSProvider;
  delegationRepository: IDelegationRepository;
};

/**
 * Shared EIP-7702 / ExactCalldata / public-relayer submit plumbing used by
 * TransactionService and DelegationService.
 */
export class TransactionUtils implements ITransactionUtils {
  constructor(private readonly options: TransactionUtilsOptions) {}

  async needsWalletUpgrade(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<boolean> {
    // Always verify on-chain. localStorage may still record the last known
    // status, but must not skip EIP-7702 auth: a cached `true` written after
    // send (before confirm) or after a failed upgrade leaves the account
    // unable to estimate on that chain.
    try {
      const status = await this.getWalletUpgradeStatus(chainId, address);
      console.debug("[business/TransactionUtils] EIP-7702 upgrade check", {
        chainId,
        address,
        upgraded: status.upgraded,
        codeAddress: status.codeAddress,
        needsUpgrade: !status.upgraded,
      });
      return !status.upgraded;
    } catch (error) {
      // Fail open: include an authorization rather than omit one when getCode
      // is unreachable (e.g. RPC origin allowlist / transient failure).
      console.warn(
        "[business/TransactionUtils] getCode failed; assuming EIP-7702 upgrade required",
        { chainId, address, error },
      );
      return true;
    }
  }

  async getWalletUpgradeStatus(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<IWalletUpgradeStatus> {
    const status = await this.readCodeUpgradeStatus(chainId, address);
    await this.options.chainRepository.setWalletUpgraded(
      chainId,
      address,
      status.upgraded,
    );
    return status;
  }

  async signWalletUpgradeAuthorization(
    chainId: EVMChainId,
  ): Promise<IRelayerAuthorizationEntry> {
    await this.options.owsProvider.ensureDisplay();
    return withCeremonyUiReason(EPasskeyPromptReason.WalletUpgrade, () =>
      this.signWalletUpgradeAuthorizationInner(chainId),
    );
  }

  private async signWalletUpgradeAuthorizationInner(
    chainId: EVMChainId,
    options?: {
      account?: LocalAccount;
      /** Prefetched so signing can share one passkey with fee/work digests. */
      nonce?: number;
      contractAddress?: `0x${string}`;
    },
  ): Promise<IRelayerAuthorizationEntry> {
    const account = options?.account ?? (await this.getViemAccount());
    const chainIdNumber = Number(BigInt(chainId));
    const client = this.options.blockchain.getPublicClient(chainId);

    let contractAddress: `0x${string}` =
      options?.contractAddress ?? STATELESS_DELEGATOR_IMPL;
    if (!options?.contractAddress) {
      try {
        const env = getSmartAccountsEnvironment(chainIdNumber);
        contractAddress = getAddress(
          env.implementations.EIP7702StatelessDeleGatorImpl,
        );
      } catch {
        // Fall back to the known Stateless7702 implementation address.
      }
    }

    const nonce =
      options?.nonce ??
      (await client.getTransactionCount({
        address: account.address,
        blockTag: "pending",
      }));

    if (!account.signAuthorization) {
      throw new Error("Signer does not support EIP-7702 signAuthorization");
    }

    const signed = await account.signAuthorization({
      chainId: chainIdNumber,
      contractAddress,
      nonce,
    });

    const yParity = yParityFromSignedAuthorization(signed);
    const entry: IRelayerAuthorizationEntry = {
      address: getAddress(signed.address),
      chainId: Number(signed.chainId),
      nonce: Number(signed.nonce),
      r: signed.r as `0x${string}`,
      s: signed.s as `0x${string}`,
      yParity,
    };

    // Verify the auth list entry recovers to this EOA before sending to the relayer.
    const recovered = await recoverAuthorizationAddress({
      authorization: {
        address: entry.address,
        chainId: entry.chainId,
        nonce: entry.nonce,
        r: entry.r,
        s: entry.s,
        yParity: entry.yParity as 0 | 1,
      },
    });
    if (getAddress(recovered) !== getAddress(account.address)) {
      throw new Error(
        `EIP-7702 authorization recovers to ${recovered}, expected ${account.address}`,
      );
    }
    console.debug("[business/TransactionUtils] EIP-7702 authorization verified", {
      eoa: account.address,
      contractAddress: entry.address,
      chainId: entry.chainId,
      nonce: entry.nonce,
      yParity: entry.yParity,
      r: entry.r,
      s: entry.s,
      recovered,
    });

    return entry;
  }

  async quotePayment(
    chainId: EVMChainId,
    owner: EVMAccountAddress,
    work: ITransactionWork | ITransactionWork[],
    preferredToken?: EVMAccountAddress,
  ): Promise<IPaymentQuote> {
    const workItems = Array.isArray(work) ? work : [work];
    if (workItems.length === 0) {
      throw new Error("quotePayment requires at least one work item");
    }

    const payment = await this.options.paymentTokenUtils.resolvePayment(
      owner,
      [chainId],
      preferredToken,
    );
    if (!payment) {
      throw new Error("No relayer payment token with a positive balance");
    }

    const tokens = await this.options.paymentTokenUtils.listPaymentOptions(
      owner,
      [chainId],
    );

    // Trust resolvePayment for chain+token (including preferredToken). Do not
    // re-match preferred by address alone — that can pick the same address on
    // a different chain and rewrite paymentChainId.
    const selected =
      tokens.find(
        (t) =>
          t.chainId === payment.paymentChainId &&
          String(t.address).toLowerCase() ===
            String(payment.paymentToken).toLowerCase(),
      ) ?? null;
    if (!selected || selected.balance <= 0n) {
      throw new Error("No relayer payment token with a positive balance");
    }

    const resolvedPayment: IRelayerPayment = {
      paymentChainId: selected.chainId,
      paymentToken: selected.address,
      paymentChainName: selected.chainName,
      balance: selected.balance,
      decimals: selected.decimals,
      symbol: selected.symbol,
    };

    const paymentChain = await this.requireRelayerChain(
      resolvedPayment.paymentChainId,
    );
    const paymentCapabilities =
      await this.options.relayerRepository.getCapabilities(
        paymentChain.relayerUrl,
        resolvedPayment.paymentChainId,
      );

    const seedFeeAtoms = makeTokenAmount(
      parseUnits("0.01", selected.decimals),
    );
    const crossChain = resolvedPayment.paymentChainId !== chainId;

    let estimate;
    if (!crossChain) {
      const chainIdNumber = Number(BigInt(chainId));
      const client = this.options.blockchain.getPublicClient(chainId);
      const viemAccount = await this.getViemAccount(owner);
      const smartAccount = await toMetaMaskSmartAccount({
        client: client as never,
        implementation: Implementation.Stateless7702,
        address: owner,
        signer: { account: viemAccount },
      });

      const feeCalldata = HexStringCompat(
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [paymentCapabilities.feeCollector, seedFeeAtoms],
        }),
      );

      const feeDelegation = this.createUnsignedExactCalldataDelegation({
        smartAccount,
        delegate: paymentCapabilities.targetAddress,
        target: selected.address,
        value: 0n,
        callData: feeCalldata,
        chainIdNumber,
      });
      const workDelegations = workItems.map((item) =>
        this.createUnsignedExactCalldataDelegation({
          smartAccount,
          delegate: paymentCapabilities.targetAddress,
          target: item.to,
          value: item.value ?? 0n,
          callData: (item.data || "0x") as Hex,
          chainIdNumber,
        }),
      );

      const params: IRelayer7710Params = {
        chainId: chainIdNumber.toString(10),
        transactions: [
          {
            permissionContext: [toRelayerJson(feeDelegation)],
            executions: [
              {
                target: selected.address,
                value: "0",
                data: feeCalldata as HexString,
              },
            ],
          },
          ...workItems.map((item, index) => {
            const value = item.value ?? 0n;
            return {
              permissionContext: [toRelayerJson(workDelegations[index])],
              executions: [
                {
                  target: item.to,
                  value: value === 0n ? "0" : `0x${value.toString(16)}`,
                  data: (item.data || "0x") as HexString,
                },
              ],
            };
          }),
        ],
      };

      console.debug(
        "[business/TransactionUtils] quotePayment unsigned estimate",
        {
          chainId,
          paymentChainId: resolvedPayment.paymentChainId,
          paymentToken: selected.address,
          workCount: workItems.length,
          crossChain: false,
        },
      );

      estimate = await this.options.relayerRepository.estimate7710Transaction(
        paymentChain.relayerUrl,
        params,
      );
    } else {
      estimate = await this.quotePaymentCrossChain({
        owner,
        executionChainId: chainId,
        payment: resolvedPayment,
        workItems,
        seedFeeAtoms,
        paymentCapabilities,
      });
    }

    if (!estimate.success || !estimate.requiredPaymentAmount) {
      throw new Error(
        estimate.error ?? "relayer_estimate7710Transaction failed",
      );
    }

    const feeAtoms = tokenAmountFromAtomString(estimate.requiredPaymentAmount);

    return {
      tokens,
      selectedToken: selected.address,
      paymentChainId: resolvedPayment.paymentChainId,
      paymentChainName: resolvedPayment.paymentChainName,
      feeAtoms,
      feeFormatted: formatUnits(feeAtoms, selected.decimals),
      feeCollector: paymentCapabilities.feeCollector,
      targetAddress: paymentCapabilities.targetAddress,
      minFee: feeAtoms,
    };
  }

  async quoteActivation(
    owner: EVMAccountAddress,
    upgradeChainIds: readonly EVMChainId[],
    payment: IRelayerPayment,
  ): Promise<IPaymentQuote> {
    if (upgradeChainIds.length === 0) {
      throw new Error("quoteActivation requires at least one upgrade chain");
    }

    const paymentChain = await this.requireRelayerChain(payment.paymentChainId);
    const unsigned = await this.buildActivationParams({
      eoa: owner,
      upgradeChainIds,
      payment,
      feeAtoms: makeTokenAmount(parseUnits("0.01", payment.decimals)),
      signed: false,
    });

    const useMultichain = shouldUseActivationMultichain(
      upgradeChainIds,
      payment.paymentChainId,
    );

    const estimate = useMultichain
      ? await this.options.relayerRepository.estimate7710TransactionMultichain(
          paymentChain.relayerUrl,
          unsigned,
        )
      : await this.options.relayerRepository.estimate7710Transaction(
          paymentChain.relayerUrl,
          unsigned[0]!,
        );

    if (!estimate.success || !estimate.requiredPaymentAmount) {
      throw new Error(
        estimate.error ?? "relayer activation estimate failed",
      );
    }

    const feeAtoms = tokenAmountFromAtomString(estimate.requiredPaymentAmount);
    const capabilities = await this.options.relayerRepository.getCapabilities(
      paymentChain.relayerUrl,
      payment.paymentChainId,
    );

    const tokenOption: IPaymentTokenOption = {
      address: payment.paymentToken,
      symbol: payment.symbol,
      decimals: payment.decimals,
      balance: payment.balance,
      chainId: payment.paymentChainId,
      chainName: payment.paymentChainName,
    };

    return {
      tokens: [tokenOption],
      selectedToken: payment.paymentToken,
      paymentChainId: payment.paymentChainId,
      paymentChainName: payment.paymentChainName,
      feeAtoms,
      feeFormatted: formatUnits(feeAtoms, payment.decimals),
      feeCollector: capabilities.feeCollector,
      targetAddress: capabilities.targetAddress,
      minFee: feeAtoms,
    };
  }

  async quotePaymentMultichain(
    owner: EVMAccountAddress,
    workByChain: readonly {
      chainId: EVMChainId;
      work: ITransactionWork | ITransactionWork[];
    }[],
    preferredToken?: EVMAccountAddress,
  ): Promise<IPaymentQuote> {
    const groups = normalizeWorkByChain(workByChain);
    if (groups.length === 0) {
      throw new Error("quotePaymentMultichain requires at least one work item");
    }

    const executionChainIds = groups.map((g) => g.chainId);
    if (
      groups.length === 1 &&
      executionChainIds[0] !== undefined
    ) {
      return this.quotePayment(
        executionChainIds[0],
        owner,
        groups[0]!.work,
        preferredToken,
      );
    }

    const payment = await this.options.paymentTokenUtils.resolvePayment(
      owner,
      executionChainIds,
      preferredToken,
    );
    if (!payment) {
      throw new Error("No relayer payment token with a positive balance");
    }

    const tokens = await this.options.paymentTokenUtils.listPaymentOptions(
      owner,
      executionChainIds,
    );

    // Trust resolvePayment for chain+token (including preferredToken). Do not
    // re-match preferred by address alone — that can pick the same address on
    // a different chain and rewrite paymentChainId.
    const selected =
      tokens.find(
        (t) =>
          t.chainId === payment.paymentChainId &&
          String(t.address).toLowerCase() ===
            String(payment.paymentToken).toLowerCase(),
      ) ?? null;
    if (!selected || selected.balance <= 0n) {
      throw new Error("No relayer payment token with a positive balance");
    }

    const resolvedPayment: IRelayerPayment = {
      paymentChainId: selected.chainId,
      paymentToken: selected.address,
      paymentChainName: selected.chainName,
      balance: selected.balance,
      decimals: selected.decimals,
      symbol: selected.symbol,
    };

    const paymentChain = await this.requireRelayerChain(
      resolvedPayment.paymentChainId,
    );
    const paymentCapabilities =
      await this.options.relayerRepository.getCapabilities(
        paymentChain.relayerUrl,
        resolvedPayment.paymentChainId,
      );

    const seedFeeAtoms = makeTokenAmount(
      parseUnits("0.01", selected.decimals),
    );

    const estimate = await this.quotePaymentWorkMultichain({
      owner,
      payment: resolvedPayment,
      groups,
      seedFeeAtoms,
      paymentCapabilities,
    });

    if (!estimate.success || !estimate.requiredPaymentAmount) {
      throw new Error(
        estimate.error ?? "relayer_estimate7710TransactionMultichain failed",
      );
    }

    const feeAtoms = tokenAmountFromAtomString(estimate.requiredPaymentAmount);

    return {
      tokens,
      selectedToken: selected.address,
      paymentChainId: resolvedPayment.paymentChainId,
      paymentChainName: resolvedPayment.paymentChainName,
      feeAtoms,
      feeFormatted: formatUnits(feeAtoms, selected.decimals),
      feeCollector: paymentCapabilities.feeCollector,
      targetAddress: paymentCapabilities.targetAddress,
      minFee: feeAtoms,
    };
  }

  async activateDelegations(args: {
    upgradeChainIds: readonly EVMChainId[];
    payment: IRelayerPayment;
    feeAtoms: TokenAmount;
    retainDisplayDuringSubmit?: boolean;
    onAwaitingConfirmation?: () => void;
    onFinalFeeRequired?: (fee: IFinalRelayerFee) => Promise<void>;
  }): Promise<ISendTransactionResult[]> {
    const {
      payment,
      onAwaitingConfirmation,
      onFinalFeeRequired,
      retainDisplayDuringSubmit,
    } = args;
    const upgradeChainIds = [...args.upgradeChainIds];
    if (upgradeChainIds.length === 0) {
      throw new Error("activateDelegations requires at least one upgrade chain");
    }

    let feeAtoms = args.feeAtoms;
    const paymentChain = await this.requireRelayerChain(payment.paymentChainId);
    const useMultichain = shouldUseActivationMultichain(
      upgradeChainIds,
      payment.paymentChainId,
    );

    const signer = await this.options.owsProvider.getSigner();
    const eoa =
      signer.getCachedAddress?.() ??
      loadCachedEvmAddress() ??
      (await signer.evm.getAccountAddress());

    await this.options.owsProvider.ensureDisplay();
    try {
      const delegationSecret = await loadOrCreateDelegationBinding();
      const viemAccount = await this.getViemAccount(eoa);
      const destinationUrl = styleController.get().destinationUrl;
      const memo = buildMemo(
        eoa,
        this.options.presentationTransactionUtils.resolveHostDomain(),
      );

      // Prefetch upgrade nonces/contracts before the coalesced ceremony.
      const upgradePrep = await Promise.all(
        upgradeChainIds.map(async (chainId) => {
          const chainIdNumber = Number(BigInt(chainId));
          const client = this.options.blockchain.getPublicClient(chainId);
          let contractAddress: `0x${string}` = STATELESS_DELEGATOR_IMPL;
          try {
            const env = getSmartAccountsEnvironment(chainIdNumber);
            contractAddress = getAddress(
              env.implementations.EIP7702StatelessDeleGatorImpl,
            );
          } catch {
            // keep hardcoded fallback
          }
          const nonce = await client.getTransactionCount({
            address: getAddress(eoa),
            blockTag: "pending",
          });
          return { chainId, chainIdNumber, contractAddress, nonce };
        }),
      );

      const paymentCapabilities =
        await this.options.relayerRepository.getCapabilities(
          paymentChain.relayerUrl,
          payment.paymentChainId,
        );
      const paymentChainIdNumber = Number(BigInt(payment.paymentChainId));
      const paymentClient = this.options.blockchain.getPublicClient(
        payment.paymentChainId,
      );
      const paymentSmartAccount = await toMetaMaskSmartAccount({
        client: paymentClient as never,
        implementation: Implementation.Stateless7702,
        address: eoa,
        signer: { account: viemAccount },
      });

      const chainSmartAccounts = new Map<
        string,
        Awaited<ReturnType<typeof toMetaMaskSmartAccount>>
      >();
      const upgradeCapabilities = new Map<
        string,
        Awaited<
          ReturnType<IOneshotRelayerRepository["getCapabilities"]>
        >
      >();
      chainSmartAccounts.set(
        payment.paymentChainId,
        paymentSmartAccount,
      );
      upgradeCapabilities.set(
        payment.paymentChainId,
        paymentCapabilities,
      );
      const missingUpgradeIds = upgradeChainIds.filter(
        (chainId) => !chainSmartAccounts.has(chainId),
      );
      await Promise.all(
        missingUpgradeIds.map(async (chainId) => {
          const key = chainId;
          if (!upgradeCapabilities.has(key)) {
            const chain = await this.requireRelayerChain(chainId);
            const caps = await this.options.relayerRepository.getCapabilities(
              chain.relayerUrl,
              chainId,
            );
            upgradeCapabilities.set(key, caps);
          }
          const client = this.options.blockchain.getPublicClient(chainId);
          const smartAccount = await toMetaMaskSmartAccount({
            client: client as never,
            implementation: Implementation.Stateless7702,
            address: eoa,
            signer: { account: viemAccount },
          });
          chainSmartAccounts.set(key, smartAccount);
        }),
      );

      const feeCalldata = HexStringCompat(
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [paymentCapabilities.feeCollector, feeAtoms],
        }),
      );

      const approveCopy = approveTransactionCeremony(true);
      const minCalls = upgradeChainIds.length * 2 + 1;

      const signed = await withCeremonyUiReason(
        EPasskeyPromptReason.ApproveTransaction,
        () =>
          withCoalescedSignDigest(
            signer,
            approveCopy,
            async () => {
              const [authEntries, feeDelegation, workDelegations] =
                await Promise.all([
                  Promise.all(
                    upgradePrep.map((prep) =>
                      this.signWalletUpgradeAuthorizationInner(prep.chainId, {
                        account: viemAccount,
                        nonce: prep.nonce,
                        contractAddress: prep.contractAddress,
                      }),
                    ),
                  ),
                  this.createAndSignExactCalldataDelegation({
                    smartAccount: paymentSmartAccount,
                    delegate: paymentCapabilities.targetAddress,
                    target: payment.paymentToken,
                    value: 0n,
                    callData: feeCalldata,
                    chainIdNumber: paymentChainIdNumber,
                  }),
                  Promise.all(
                    upgradeChainIds.map((chainId) => {
                      const smartAccount = chainSmartAccounts.get(
                        chainId,
                      );
                      const caps = upgradeCapabilities.get(chainId);
                      if (!smartAccount || !caps) {
                        throw new Error(
                          `Missing smart account or capabilities for ${chainId}`,
                        );
                      }
                      return this.createAndSignActivationNoOpDelegation({
                        smartAccount,
                        delegate: caps.targetAddress,
                      });
                    }),
                  ),
                ]);
              return { authEntries, feeDelegation, workDelegations };
            },
            { minCalls } satisfies CoalesceSignDigestOptions,
          ),
      );

      const authByChain = new Map<string, IRelayerAuthorizationEntry>();
      for (let i = 0; i < upgradeChainIds.length; i += 1) {
        authByChain.set(
          upgradeChainIds[i]!,
          signed.authEntries[i]!,
        );
      }
      let feeDelegation = signed.feeDelegation;
      const workByChain = new Map<string, unknown>();
      for (let i = 0; i < upgradeChainIds.length; i += 1) {
        workByChain.set(
          upgradeChainIds[i]!,
          signed.workDelegations[i]!,
        );
      }

      const buildChainParams = async (
        feeAmount: TokenAmount,
        contexts?: Record<string, string>,
      ): Promise<IRelayer7710Params[]> => {
        const feeData = HexStringCompat(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [paymentCapabilities.feeCollector, feeAmount],
          }),
        );

        const orderedChainIds = orderedActivationChainIds(
          upgradeChainIds,
          payment.paymentChainId,
        );

        return Promise.all(
          orderedChainIds.map(async (chainId) => {
            const isPayment = chainId === payment.paymentChainId;
            const needsUpgrade = upgradeChainIds.some((id) =>
              id === chainId,
            );
            const chainKey = chainId;
            const transactions: IRelayer7710Params["transactions"] = [];

            if (isPayment) {
              transactions.push({
                permissionContext: [toRelayerJson(feeDelegation)],
                executions: [
                  {
                    target: payment.paymentToken,
                    value: "0",
                    data: feeData as HexString,
                  },
                ],
              });
            }

            if (needsUpgrade) {
              const workSig = workByChain.get(chainKey);
              if (!workSig) {
                throw new Error(
                  `Missing work delegation for upgrade chain ${chainId}`,
                );
              }
              transactions.push({
                permissionContext: [toRelayerJson(workSig)],
                executions: [
                  {
                    target: ACTIVATION_NOOP_TARGET,
                    value: "0",
                    data: EMPTY_CALLDATA as HexString,
                  },
                ],
              });
            }

            if (transactions.length === 0) {
              throw new Error(
                `Activation params for chain ${chainId} have no transactions`,
              );
            }

            const auth = authByChain.get(chainKey);
            const context = contexts?.[chainKey];
            return {
              chainId: chainKey,
              transactions,
              ...(auth ? { authorizationList: [auth] } : {}),
              ...(context ? { context } : {}),
              memo,
              delegationSecret,
              ...(destinationUrl ? { destinationUrl } : {}),
            } satisfies IRelayer7710Params;
          }),
        );
      };

      let params = await buildChainParams(feeAtoms);
      let estimate = useMultichain
        ? await this.options.relayerRepository.estimate7710TransactionMultichain(
            paymentChain.relayerUrl,
            params,
          )
        : await this.options.relayerRepository.estimate7710Transaction(
            paymentChain.relayerUrl,
            params[0]!,
          );

      if (
        estimate.success &&
        estimate.requiredPaymentAmount &&
        tokenAmountFromAtomString(estimate.requiredPaymentAmount) > feeAtoms
      ) {
        feeAtoms = tokenAmountFromAtomString(estimate.requiredPaymentAmount);
        if (onFinalFeeRequired) {
          await onFinalFeeRequired({
            feeAtoms,
            feeFormatted: formatUnits(feeAtoms, payment.decimals),
            paymentToken: payment.paymentToken,
          });
        }

        const nextFeeCalldata = HexStringCompat(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [paymentCapabilities.feeCollector, feeAtoms],
          }),
        );
        const adjustCopy = adjustFeeCeremony();
        feeDelegation = await withCeremonyUiReason(
          EPasskeyPromptReason.AdjustFee,
          () =>
            withCoalescedSignDigest(signer, adjustCopy, () =>
              this.createAndSignExactCalldataDelegation({
                smartAccount: paymentSmartAccount,
                delegate: paymentCapabilities.targetAddress,
                target: payment.paymentToken,
                value: 0n,
                callData: nextFeeCalldata,
                chainIdNumber: paymentChainIdNumber,
              }),
            ),
        );
        params = await buildChainParams(feeAtoms);
      }

      if (!estimate.success) {
        throw new Error(
          estimate.error ?? "relayer activation estimate failed",
        );
      }

      if (!retainDisplayDuringSubmit) {
        await this.options.owsProvider.hideDisplay();
      } else {
        onAwaitingConfirmation?.();
      }

      const contextByChainId =
        estimate.contextByChainId ??
        (estimate.context
          ? {
              [payment.paymentChainId]: estimate.context,
            }
          : undefined);
      params = await buildChainParams(feeAtoms, contextByChainId);

      const taskIds = useMultichain
        ? await this.options.relayerRepository.send7710TransactionMultichain(
            paymentChain.relayerUrl,
            params,
          )
        : [
            await this.options.relayerRepository.send7710Transaction(
              paymentChain.relayerUrl,
              params[0]!,
            ),
          ];

      const orderedChainIds = orderedActivationChainIds(
        upgradeChainIds,
        payment.paymentChainId,
      );

      try {
        const results = await Promise.all(
          taskIds.map(async (taskId, i) => {
            const chainId = orderedChainIds[i]!;
            const hash = await this.pollUntilTerminal(
              paymentChain.relayerUrl,
              taskId,
            );
            if (
              upgradeChainIds.some((id) => id === chainId)
            ) {
              await this.options.chainRepository.setWalletUpgraded(
                chainId,
                eoa,
                true,
              );
            }
            return {
              relayerTransactionId: taskId,
              transactionHash: hash,
            } satisfies ISendTransactionResult;
          }),
        );
        return results;
      } catch (pollError) {
        await Promise.all(
          upgradeChainIds.map((chainId) =>
            this.options.chainRepository.setWalletUpgraded(
              chainId,
              eoa,
              false,
            ),
          ),
        );
        throw pollError;
      }
    } catch (error) {
      if (!retainDisplayDuringSubmit) {
        await this.options.owsProvider.hideDisplay();
      }
      throw error;
    }
  }

  async sendViaRelayerMultichain(args: {
    workByChain: readonly {
      chainId: EVMChainId;
      work: ITransactionWork | ITransactionWork[];
    }[];
    paymentToken: EVMAccountAddress;
    feeAtoms: TokenAmount;
    paymentChainId: EVMChainId;
    prefetchRelayerVaultAssertion?: boolean;
    retainDisplayDuringSubmit?: boolean;
    onAwaitingConfirmation?: () => void;
    onFinalFeeRequired?: (fee: IFinalRelayerFee) => Promise<void>;
  }): Promise<ISendTransactionResult[]> {
    const groups = normalizeWorkByChain(args.workByChain);
    if (groups.length === 0) {
      throw new Error("sendViaRelayerMultichain requires at least one work item");
    }

    const {
      paymentToken,
      paymentChainId,
      onAwaitingConfirmation,
      onFinalFeeRequired,
      retainDisplayDuringSubmit,
    } = args;
    let feeAtoms: TokenAmount = args.feeAtoms;

    const workChainIds = groups.map((g) => g.chainId);
    if (
      groups.length === 1 &&
      workChainIds[0] === paymentChainId
    ) {
      const chain = await this.requireRelayerChain(paymentChainId);
      const single = await this.sendViaRelayer({
        chainId: paymentChainId,
        work: groups[0]!.work,
        paymentToken,
        feeAtoms,
        paymentChainId,
        relayerUrl: chain.relayerUrl,
        prefetchRelayerVaultAssertion: args.prefetchRelayerVaultAssertion,
        retainDisplayDuringSubmit,
        onAwaitingConfirmation,
        onFinalFeeRequired,
      });
      return [single];
    }

    const paymentChain = await this.requireRelayerChain(paymentChainId);
    const useMultichain = shouldUseActivationMultichain(
      workChainIds,
      paymentChainId,
    );

    const signer = await this.options.owsProvider.getSigner();
    const eoa =
      signer.getCachedAddress?.() ??
      loadCachedEvmAddress() ??
      (await signer.evm.getAccountAddress());

    await this.options.owsProvider.ensureDisplay();
    try {
      const delegationSecret = await loadOrCreateDelegationBinding();
      const viemAccount = await this.getViemAccount(eoa);
      const destinationUrl = styleController.get().destinationUrl;
      const memo = buildMemo(
        eoa,
        this.options.presentationTransactionUtils.resolveHostDomain(),
      );

      const paymentCapabilities =
        await this.options.relayerRepository.getCapabilities(
          paymentChain.relayerUrl,
          paymentChainId,
        );
      const paymentChainIdNumber = Number(BigInt(paymentChainId));
      const paymentClient =
        this.options.blockchain.getPublicClient(paymentChainId);
      const paymentSmartAccount = await toMetaMaskSmartAccount({
        client: paymentClient as never,
        implementation: Implementation.Stateless7702,
        address: eoa,
        signer: { account: viemAccount },
      });

      const chainSmartAccounts = new Map<
        EVMChainId,
        Awaited<ReturnType<typeof toMetaMaskSmartAccount>>
      >();
      const chainCapabilities = new Map<
        EVMChainId,
        Awaited<ReturnType<IOneshotRelayerRepository["getCapabilities"]>>
      >();
      chainSmartAccounts.set(paymentChainId, paymentSmartAccount);
      chainCapabilities.set(paymentChainId, paymentCapabilities);

      await Promise.all(
        workChainIds.map(async (chainId) => {
          if (chainSmartAccounts.has(chainId)) return;
          const chain = await this.requireRelayerChain(chainId);
          const caps = await this.options.relayerRepository.getCapabilities(
            chain.relayerUrl,
            chainId,
          );
          chainCapabilities.set(chainId, caps);
          const client = this.options.blockchain.getPublicClient(chainId);
          const smartAccount = await toMetaMaskSmartAccount({
            client: client as never,
            implementation: Implementation.Stateless7702,
            address: eoa,
            signer: { account: viemAccount },
          });
          chainSmartAccounts.set(chainId, smartAccount);
        }),
      );

      const upgradePrep = await Promise.all(
        workChainIds.map(async (chainId) => {
          const needsUpgrade = await this.needsWalletUpgrade(chainId, eoa);
          if (!needsUpgrade) {
            return { chainId, needsUpgrade: false as const };
          }
          const chainIdNumber = Number(BigInt(chainId));
          const client = this.options.blockchain.getPublicClient(chainId);
          let contractAddress: `0x${string}` = STATELESS_DELEGATOR_IMPL;
          try {
            const env = getSmartAccountsEnvironment(chainIdNumber);
            contractAddress = getAddress(
              env.implementations.EIP7702StatelessDeleGatorImpl,
            );
          } catch {
            // keep hardcoded fallback
          }
          const nonce = await client.getTransactionCount({
            address: getAddress(eoa),
            blockTag: "pending",
          });
          return {
            chainId,
            needsUpgrade: true as const,
            chainIdNumber,
            contractAddress,
            nonce,
          };
        }),
      );

      const feeCalldata = HexStringCompat(
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [paymentCapabilities.feeCollector, feeAtoms],
        }),
      );

      const upgradeCount = upgradePrep.filter((p) => p.needsUpgrade).length;
      const workCount = groups.reduce((n, g) => n + g.work.length, 0);
      const approveCopy = approveTransactionCeremony(upgradeCount > 0);
      const minCalls = upgradeCount + 1 + workCount;
      const coalesceOptions: CoalesceSignDigestOptions = { minCalls };
      if (args.prefetchRelayerVaultAssertion) {
        const { challengeId, challenge } =
          await this.options.delegationRepository.mintRelayerVaultChallenge();
        coalesceOptions.challenge = challenge as `0x${string}`;
        coalesceOptions.onBatchAssertion = (assertion) => {
          this.options.delegationRepository.cacheRelayerVaultAssertion(
            challengeId,
            assertion,
          );
        };
      }

      const signed = await withCeremonyUiReason(
        EPasskeyPromptReason.ApproveTransaction,
        () =>
          withCoalescedSignDigest(
            signer,
            approveCopy,
            async () => {
              const authEntries = await Promise.all(
                upgradePrep.map((prep) =>
                  prep.needsUpgrade
                    ? this.signWalletUpgradeAuthorizationInner(prep.chainId, {
                        account: viemAccount,
                        nonce: prep.nonce,
                        contractAddress: prep.contractAddress,
                      })
                    : Promise.resolve(undefined),
                ),
              );
              const feeDelegation =
                await this.createAndSignExactCalldataDelegation({
                  smartAccount: paymentSmartAccount,
                  delegate: paymentCapabilities.targetAddress,
                  target: paymentToken,
                  value: 0n,
                  callData: feeCalldata,
                  chainIdNumber: paymentChainIdNumber,
                });
              const workDelegationsByChain = new Map<EVMChainId, unknown[]>();
              await Promise.all(
                groups.map(async (group) => {
                  const smartAccount = chainSmartAccounts.get(group.chainId);
                  const caps = chainCapabilities.get(group.chainId);
                  if (!smartAccount || !caps) {
                    throw new Error(
                      `Missing smart account or capabilities for ${group.chainId}`,
                    );
                  }
                  const chainIdNumber = Number(BigInt(group.chainId));
                  const workDelegations = await Promise.all(
                    group.work.map((item) =>
                      this.createAndSignExactCalldataDelegation({
                        smartAccount,
                        delegate: caps.targetAddress,
                        target: item.to,
                        value: item.value ?? 0n,
                        callData: (item.data || "0x") as Hex,
                        chainIdNumber,
                      }),
                    ),
                  );
                  workDelegationsByChain.set(group.chainId, workDelegations);
                }),
              );
              return { authEntries, feeDelegation, workDelegationsByChain };
            },
            coalesceOptions,
          ),
      );

      const authByChain = new Map<EVMChainId, IRelayerAuthorizationEntry>();
      for (let i = 0; i < workChainIds.length; i += 1) {
        const entry = signed.authEntries[i];
        if (entry) authByChain.set(workChainIds[i]!, entry);
      }
      let feeDelegation = signed.feeDelegation;
      const workDelegationsByChain = signed.workDelegationsByChain;

      const buildChainParams = (
        feeAmount: TokenAmount,
        contexts?: Record<string, string>,
      ): IRelayer7710Params[] => {
        const feeData = HexStringCompat(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [paymentCapabilities.feeCollector, feeAmount],
          }),
        );
        const orderedChainIds = orderedActivationChainIds(
          workChainIds,
          paymentChainId,
        );
        return orderedChainIds.map((chainId) => {
          const isPayment = chainId === paymentChainId;
          const group = groups.find((g) => g.chainId === chainId);
          const transactions: IRelayer7710Params["transactions"] = [];

          if (isPayment) {
            transactions.push({
              permissionContext: [toRelayerJson(feeDelegation)],
              executions: [
                {
                  target: paymentToken,
                  value: "0",
                  data: feeData as HexString,
                },
              ],
            });
          }

          if (group) {
            const workSigs = workDelegationsByChain.get(chainId);
            if (!workSigs || workSigs.length !== group.work.length) {
              throw new Error(
                `Missing work delegations for chain ${chainId}`,
              );
            }
            for (let i = 0; i < group.work.length; i += 1) {
              const item = group.work[i]!;
              const value = item.value ?? 0n;
              transactions.push({
                permissionContext: [toRelayerJson(workSigs[i])],
                executions: [
                  {
                    target: item.to,
                    value: value === 0n ? "0" : `0x${value.toString(16)}`,
                    data: (item.data || "0x") as HexString,
                  },
                ],
              });
            }
          }

          if (transactions.length === 0) {
            throw new Error(
              `Multichain params for chain ${chainId} have no transactions`,
            );
          }

          const auth = authByChain.get(chainId);
          const chainKey = Number(BigInt(chainId)).toString(10);
          const context = contexts?.[chainKey];
          return {
            chainId: chainKey,
            transactions,
            ...(auth ? { authorizationList: [auth] } : {}),
            ...(context ? { context } : {}),
            memo,
            delegationSecret,
            ...(destinationUrl ? { destinationUrl } : {}),
          } satisfies IRelayer7710Params;
        });
      };

      let params = buildChainParams(feeAtoms);
      let estimate = useMultichain
        ? await this.options.relayerRepository.estimate7710TransactionMultichain(
            paymentChain.relayerUrl,
            params,
          )
        : await this.options.relayerRepository.estimate7710Transaction(
            paymentChain.relayerUrl,
            params[0]!,
          );

      if (
        estimate.success &&
        estimate.requiredPaymentAmount &&
        tokenAmountFromAtomString(estimate.requiredPaymentAmount) > feeAtoms
      ) {
        feeAtoms = tokenAmountFromAtomString(estimate.requiredPaymentAmount);
        if (onFinalFeeRequired) {
          await onFinalFeeRequired({
            feeAtoms,
            feeFormatted: formatUnits(feeAtoms, paymentCapabilities.tokens.find(
              (t) =>
                String(t.address).toLowerCase() ===
                String(paymentToken).toLowerCase(),
            )?.decimals ?? 6),
            paymentToken,
          });
        }
        const nextFeeCalldata = HexStringCompat(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [paymentCapabilities.feeCollector, feeAtoms],
          }),
        );
        const adjustCopy = adjustFeeCeremony();
        feeDelegation = await withCeremonyUiReason(
          EPasskeyPromptReason.AdjustFee,
          () =>
            withCoalescedSignDigest(signer, adjustCopy, () =>
              this.createAndSignExactCalldataDelegation({
                smartAccount: paymentSmartAccount,
                delegate: paymentCapabilities.targetAddress,
                target: paymentToken,
                value: 0n,
                callData: nextFeeCalldata,
                chainIdNumber: paymentChainIdNumber,
              }),
            ),
        );
        params = buildChainParams(feeAtoms);
      }

      if (!estimate.success) {
        throw new Error(
          estimate.error ?? "relayer multichain estimate failed",
        );
      }

      if (!retainDisplayDuringSubmit) {
        await this.options.owsProvider.hideDisplay();
      } else {
        onAwaitingConfirmation?.();
      }

      const paymentChainKey = Number(BigInt(paymentChainId)).toString(10);
      const contextByChainId =
        estimate.contextByChainId ??
        (estimate.context
          ? { [paymentChainKey]: estimate.context }
          : undefined);
      params = buildChainParams(feeAtoms, contextByChainId);

      const taskIds = useMultichain
        ? await this.options.relayerRepository.send7710TransactionMultichain(
            paymentChain.relayerUrl,
            params,
          )
        : [
            await this.options.relayerRepository.send7710Transaction(
              paymentChain.relayerUrl,
              params[0]!,
            ),
          ];

      const orderedChainIds = orderedActivationChainIds(
        workChainIds,
        paymentChainId,
      );

      try {
        const byChain = new Map<EVMChainId, ISendTransactionResult>();
        await Promise.all(
          taskIds.map(async (taskId, i) => {
            const chainId = orderedChainIds[i]!;
            const hash = await this.pollUntilTerminal(
              paymentChain.relayerUrl,
              taskId,
            );
            if (authByChain.has(chainId)) {
              await this.options.chainRepository.setWalletUpgraded(
                chainId,
                eoa,
                true,
              );
            }
            byChain.set(chainId, {
              relayerTransactionId: taskId,
              transactionHash: hash,
            });
          }),
        );
        return groups.map((group) => {
          const result = byChain.get(group.chainId);
          if (!result) {
            throw new Error(
              `Missing relayer result for work chain ${group.chainId}`,
            );
          }
          return result;
        });
      } catch (pollError) {
        await Promise.all(
          [...authByChain.keys()].map((chainId) =>
            this.options.chainRepository.setWalletUpgraded(
              chainId,
              eoa,
              false,
            ),
          ),
        );
        throw pollError;
      }
    } catch (error) {
      if (!retainDisplayDuringSubmit) {
        await this.options.owsProvider.hideDisplay();
      }
      throw error;
    }
  }

  async estimateNativeTransferFee(chainId: EVMChainId): Promise<{
    gasPrice: bigint;
    maxPriorityFeePerGas: bigint;
    feeAtoms: bigint;
  }> {
    const client = this.options.blockchain.getPublicClient(chainId);
    let maxFeePerGas: bigint;
    let maxPriorityFeePerGas = 0n;
    try {
      const fees = await client.estimateFeesPerGas();
      maxFeePerGas = fees.maxFeePerGas ?? (await client.getGasPrice());
      maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? 0n;
    } catch {
      maxFeePerGas = await client.getGasPrice();
    }
    // Pin Max / balance checks to a buffered cap so a later prepare that
    // re-quotes fees (or base-fee bumps while pending) does not exceed the
    // reserved budget. Actual ETH paid is still baseFee + tip ≤ maxFeePerGas.
    const gasPrice = withNativeFeeHeadroom(maxFeePerGas);
    return {
      gasPrice,
      maxPriorityFeePerGas,
      feeAtoms: gasPrice * NATIVE_TRANSFER_GAS,
    };
  }

  async planNativeTransfer(
    chainId: EVMChainId,
    value: bigint,
  ): Promise<{
    value: bigint;
    gas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  }> {
    if (value < 0n) {
      throw new Error("Native transfer value must be non-negative");
    }
    const estimate = await this.estimateNativeTransferFee(chainId);
    const account = await this.getViemAccount();
    const client = this.options.blockchain.getPublicClient(chainId);
    const balance = await client.getBalance({ address: account.address });
    const maxSendable = maxNativeSendable(balance, estimate.feeAtoms);
    if (maxSendable <= 0n) {
      throw new Error("Insufficient balance for network fee");
    }
    // Clamp when fees moved up since Max / form validation — same pattern as
    // MetaMask refreshing Max against the fee used on the submitted tx.
    const sendValue = value > maxSendable ? maxSendable : value;
    return {
      value: sendValue,
      gas: NATIVE_TRANSFER_GAS,
      maxFeePerGas: estimate.gasPrice,
      maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
    };
  }

  async sendViaRelayer(args: {
    chainId: EVMChainId;
    work: ITransactionWork | ITransactionWork[];
    paymentToken: EVMAccountAddress;
    feeAtoms: TokenAmount;
    paymentChainId?: EVMChainId;
    authorizationList?: IRelayerAuthorizationEntry[];
    relayerUrl: string;
    prefetchRelayerVaultAssertion?: boolean;
    retainDisplayDuringSubmit?: boolean;
    onAwaitingConfirmation?: () => void;
    onFinalFeeRequired?: (fee: IFinalRelayerFee) => Promise<void>;
  }): Promise<ISendTransactionResult> {
    const paymentChainId = args.paymentChainId ?? args.chainId;
    if (paymentChainId !== args.chainId) {
      return this.sendViaRelayerCrossChain({
        ...args,
        paymentChainId,
      });
    }

    const {
      chainId,
      paymentToken,
      relayerUrl,
      onAwaitingConfirmation,
      onFinalFeeRequired,
      retainDisplayDuringSubmit,
    } = args;
    const workItems = Array.isArray(args.work) ? args.work : [args.work];
    if (workItems.length === 0) {
      throw new Error("sendViaRelayer requires at least one work item");
    }
    let feeAtoms: TokenAmount = args.feeAtoms;
    let authorizationList = args.authorizationList;

    const signer = await this.options.owsProvider.getSigner();
    const eoa =
      signer.getCachedAddress?.() ??
      loadCachedEvmAddress() ??
      (await signer.evm.getAccountAddress());

    const needsUpgrade =
      !authorizationList?.length &&
      (await this.needsWalletUpgrade(chainId, eoa));

    console.debug("[business/TransactionUtils] sendViaRelayer", {
      chainId,
      eoa,
      needsUpgrade,
      presuppliedAuth: Boolean(authorizationList?.length),
    });

    await this.options.owsProvider.ensureDisplay();
    try {
      const delegationSecret = await loadOrCreateDelegationBinding();
      // Bind the LocalAccount to the same EOA used for upgrade checks / nonce /
      // smartAccount — do not re-resolve address inside getViemAccount.
      const viemAccount = await this.getViemAccount(eoa);
      const publicClient = this.options.blockchain.getPublicClient(chainId);
      const chainIdNumber = Number(BigInt(chainId));

      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient as never,
        implementation: Implementation.Stateless7702,
        address: eoa,
        signer: { account: viemAccount },
      });

      const capabilities = await this.options.relayerRepository.getCapabilities(
        relayerUrl,
        chainId,
      );

      // Prefetch EIP-7702 inputs before the coalesced ceremony. A nonce RPC
      // inside Promise.all lets fee/work start a signer Confirm first; the
      // later auth RPC then cancels it (`ceremonyCancelled`).
      let upgradeNonce: number | undefined;
      let upgradeContract: `0x${string}` | undefined;
      if (needsUpgrade) {
        upgradeContract = STATELESS_DELEGATOR_IMPL;
        try {
          const env = getSmartAccountsEnvironment(chainIdNumber);
          upgradeContract = getAddress(
            env.implementations.EIP7702StatelessDeleGatorImpl,
          );
        } catch {
          // keep hardcoded fallback
        }
        upgradeNonce = await publicClient.getTransactionCount({
          address: getAddress(eoa),
          blockTag: "pending",
        });
      }

      const feeCalldata = HexStringCompat(
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [capabilities.feeCollector, feeAtoms],
        }),
      );

      const approveCopy = approveTransactionCeremony(needsUpgrade);
      const minCalls = (needsUpgrade ? 1 : 0) + 1 + workItems.length;

      const coalesceOptions: CoalesceSignDigestOptions = { minCalls };
      if (args.prefetchRelayerVaultAssertion) {
        const { challengeId, challenge } =
          await this.options.delegationRepository.mintRelayerVaultChallenge();
        coalesceOptions.challenge = challenge as `0x${string}`;
        coalesceOptions.onBatchAssertion = (assertion) => {
          this.options.delegationRepository.cacheRelayerVaultAssertion(
            challengeId,
            assertion,
          );
        };
      }

      // One passkey: optional EIP-7702 auth + fee + each work delegation
      // (+ relayer vault auth when prefetchRelayerVaultAssertion).
      const signed = await withCeremonyUiReason(
        EPasskeyPromptReason.ApproveTransaction,
        () =>
          withCoalescedSignDigest(
            signer,
            approveCopy,
            async () => {
              const [authEntry, feeDelegation, ...workDelegations] =
                await Promise.all([
                  needsUpgrade
                    ? this.signWalletUpgradeAuthorizationInner(chainId, {
                        account: viemAccount,
                        nonce: upgradeNonce,
                        contractAddress: upgradeContract,
                      })
                    : Promise.resolve(undefined),
                  this.createAndSignExactCalldataDelegation({
                    smartAccount,
                    delegate: capabilities.targetAddress,
                    target: paymentToken,
                    value: 0n,
                    callData: feeCalldata,
                    chainIdNumber,
                  }),
                  ...workItems.map((item) =>
                    this.createAndSignExactCalldataDelegation({
                      smartAccount,
                      delegate: capabilities.targetAddress,
                      target: item.to,
                      value: item.value ?? 0n,
                      callData: (item.data || "0x") as Hex,
                      chainIdNumber,
                    }),
                  ),
                ]);
              return { authEntry, feeDelegation, workDelegations };
            },
            coalesceOptions,
          ),
      );

      if (signed.authEntry) {
        authorizationList = [signed.authEntry];
      } else if (needsUpgrade) {
        throw new Error(
          "EIP-7702 wallet upgrade was required but no authorization was signed",
        );
      }
      let feeDelegation = signed.feeDelegation;
      const workDelegations = signed.workDelegations;

      const buildParams = (
        feeSig: unknown,
        feeAmount: bigint,
        context?: string,
      ): IRelayer7710Params => {
        const feeData = HexStringCompat(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [capabilities.feeCollector, feeAmount],
          }),
        );
        const destinationUrl = styleController.get().destinationUrl;
        return {
          chainId: chainIdNumber.toString(10),
          transactions: [
            {
              permissionContext: [toRelayerJson(feeSig)],
              executions: [
                {
                  target: paymentToken,
                  value: "0",
                  data: feeData as HexString,
                },
              ],
            },
            ...workItems.map((item, index) => {
              const value = item.value ?? 0n;
              return {
                permissionContext: [toRelayerJson(workDelegations[index])],
                executions: [
                  {
                    target: item.to,
                    value: value === 0n ? "0" : `0x${value.toString(16)}`,
                    data: (item.data || "0x") as HexString,
                  },
                ],
              };
            }),
          ],
          ...(authorizationList?.length
            ? { authorizationList }
            : {}),
          ...(context ? { context } : {}),
          memo: buildMemo(
            eoa,
            this.options.presentationTransactionUtils.resolveHostDomain(),
          ),
          delegationSecret,
          ...(destinationUrl ? { destinationUrl } : {}),
        };
      };

      let params = buildParams(feeDelegation, feeAtoms);
      console.debug(
        "[business/TransactionUtils] relayer_estimate7710Transaction",
        {
          chainId,
          hasAuthorizationList: Boolean(authorizationList?.length),
          authorizationChainId: authorizationList?.[0]?.chainId,
          authorizationNonce: authorizationList?.[0]?.nonce,
          authorizationAddress: authorizationList?.[0]?.address,
        },
      );
      let estimate =
        await this.options.relayerRepository.estimate7710Transaction(
          relayerUrl,
          params,
        );

      if (
        estimate.success &&
        estimate.requiredPaymentAmount &&
        tokenAmountFromAtomString(estimate.requiredPaymentAmount) > feeAtoms
      ) {
        feeAtoms = tokenAmountFromAtomString(estimate.requiredPaymentAmount);
        const paymentTokenMeta = capabilities.tokens.find(
          (token) =>
            String(token.address).toLowerCase() ===
            String(paymentToken).toLowerCase(),
        );
        const feeDecimals = paymentTokenMeta?.decimals ?? 6;

        if (onFinalFeeRequired) {
          await onFinalFeeRequired({
            feeAtoms,
            feeFormatted: formatUnits(feeAtoms, feeDecimals),
            paymentToken,
          });
        }

        const nextFeeCalldata = HexStringCompat(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [capabilities.feeCollector, feeAtoms],
          }),
        );
        const adjustCopy = adjustFeeCeremony();
        feeDelegation = await withCeremonyUiReason(
          EPasskeyPromptReason.AdjustFee,
          () =>
            withCoalescedSignDigest(signer, adjustCopy, () =>
              this.createAndSignExactCalldataDelegation({
                smartAccount,
                delegate: capabilities.targetAddress,
                target: paymentToken,
                value: 0n,
                callData: nextFeeCalldata,
                chainIdNumber,
              }),
            ),
        );
        params = buildParams(feeDelegation, feeAtoms);
        // Keep estimate₁ context + requiredPaymentAmount. A second estimate would
        // mint a new quote while leaving feeAtoms at required₁ — payment/context
        // mismatch under rising gas. Match the UI fee-bump path (no re-estimate).
      }
      // If signed required ≤ quoted feeAtoms, keep the already-signed fee
      // ExactCalldata (slight overpay is fine; no AdjustFee ceremony).

      if (!estimate.success) {
        throw new Error(
          estimate.error ?? "relayer_estimate7710Transaction failed",
        );
      }

      // Last passkey is done — collapse the flyout while submit/poll run.
      if (!retainDisplayDuringSubmit) {
        await this.options.owsProvider.hideDisplay();
      } else {
        onAwaitingConfirmation?.();
      }

      params = buildParams(feeDelegation, feeAtoms, estimate.context);
      console.debug(
        "[business/TransactionUtils] relayer_send7710Transaction",
        {
          chainId,
          hasAuthorizationList: Boolean(authorizationList?.length),
          authorizationChainId: authorizationList?.[0]?.chainId,
          authorizationNonce: authorizationList?.[0]?.nonce,
        },
      );
      const taskId = await this.options.relayerRepository.send7710Transaction(
        relayerUrl,
        params,
      );

      try {
        const hash = await this.pollUntilTerminal(relayerUrl, taskId);
        // Only cache "upgraded" after the type-4 tx confirms on-chain.
        if (authorizationList?.length) {
          await this.options.chainRepository.setWalletUpgraded(
            chainId,
            eoa,
            true,
          );
        }
        return {
          relayerTransactionId: taskId,
          transactionHash: hash,
        };
      } catch (pollError) {
        // Auth may or may not have landed; force a fresh getCode next time.
        if (authorizationList?.length) {
          await this.options.chainRepository.setWalletUpgraded(
            chainId,
            eoa,
            false,
          );
        }
        throw pollError;
      }
    } catch (error) {
      // Host-initiated sends collapse the flyout on failure; in-wallet flows
      // (TransferTokensModal, cancel) keep the open display.
      if (!retainDisplayDuringSubmit) {
        await this.options.owsProvider.hideDisplay();
      }
      throw error;
    }
  }

  /**
   * Fee ExactCalldata on `paymentChainId`, work (+ optional EIP-7702) on
   * `chainId`, submitted via multichain 7710.
   */
  private async sendViaRelayerCrossChain(args: {
    chainId: EVMChainId;
    paymentChainId: EVMChainId;
    work: ITransactionWork | ITransactionWork[];
    paymentToken: EVMAccountAddress;
    feeAtoms: TokenAmount;
    authorizationList?: IRelayerAuthorizationEntry[];
    relayerUrl: string;
    prefetchRelayerVaultAssertion?: boolean;
    retainDisplayDuringSubmit?: boolean;
    onAwaitingConfirmation?: () => void;
    onFinalFeeRequired?: (fee: IFinalRelayerFee) => Promise<void>;
  }): Promise<ISendTransactionResult> {
    const {
      chainId: executionChainId,
      paymentChainId,
      paymentToken,
      onAwaitingConfirmation,
      onFinalFeeRequired,
      retainDisplayDuringSubmit,
    } = args;
    const workItems = Array.isArray(args.work) ? args.work : [args.work];
    if (workItems.length === 0) {
      throw new Error("sendViaRelayer requires at least one work item");
    }
    let feeAtoms: TokenAmount = args.feeAtoms;
    let authorizationList = args.authorizationList;

    const paymentChain = await this.requireRelayerChain(paymentChainId);
    const executionChain = await this.requireRelayerChain(executionChainId);

    const signer = await this.options.owsProvider.getSigner();
    const eoa =
      signer.getCachedAddress?.() ??
      loadCachedEvmAddress() ??
      (await signer.evm.getAccountAddress());

    const needsUpgrade =
      !authorizationList?.length &&
      (await this.needsWalletUpgrade(executionChainId, eoa));

    console.debug("[business/TransactionUtils] sendViaRelayerCrossChain", {
      executionChainId,
      paymentChainId,
      eoa,
      needsUpgrade,
    });

    await this.options.owsProvider.ensureDisplay();
    try {
      const delegationSecret = await loadOrCreateDelegationBinding();
      const viemAccount = await this.getViemAccount(eoa);
      const destinationUrl = styleController.get().destinationUrl;
      const memo = buildMemo(
        eoa,
        this.options.presentationTransactionUtils.resolveHostDomain(),
      );

      const paymentCapabilities =
        await this.options.relayerRepository.getCapabilities(
          paymentChain.relayerUrl,
          paymentChainId,
        );
      const executionCapabilities =
        await this.options.relayerRepository.getCapabilities(
          executionChain.relayerUrl,
          executionChainId,
        );

      const paymentChainIdNumber = Number(BigInt(paymentChainId));
      const executionChainIdNumber = Number(BigInt(executionChainId));
      const paymentClient =
        this.options.blockchain.getPublicClient(paymentChainId);
      const executionClient =
        this.options.blockchain.getPublicClient(executionChainId);

      const [paymentSmartAccount, executionSmartAccount] = await Promise.all([
        toMetaMaskSmartAccount({
          client: paymentClient as never,
          implementation: Implementation.Stateless7702,
          address: eoa,
          signer: { account: viemAccount },
        }),
        toMetaMaskSmartAccount({
          client: executionClient as never,
          implementation: Implementation.Stateless7702,
          address: eoa,
          signer: { account: viemAccount },
        }),
      ]);

      let upgradeNonce: number | undefined;
      let upgradeContract: `0x${string}` | undefined;
      if (needsUpgrade) {
        upgradeContract = STATELESS_DELEGATOR_IMPL;
        try {
          const env = getSmartAccountsEnvironment(executionChainIdNumber);
          upgradeContract = getAddress(
            env.implementations.EIP7702StatelessDeleGatorImpl,
          );
        } catch {
          // keep hardcoded fallback
        }
        upgradeNonce = await executionClient.getTransactionCount({
          address: getAddress(eoa),
          blockTag: "pending",
        });
      }

      const feeCalldata = HexStringCompat(
        encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [paymentCapabilities.feeCollector, feeAtoms],
        }),
      );

      const approveCopy = approveTransactionCeremony(needsUpgrade);
      const minCalls = (needsUpgrade ? 1 : 0) + 1 + workItems.length;
      const coalesceOptions: CoalesceSignDigestOptions = { minCalls };
      if (args.prefetchRelayerVaultAssertion) {
        const { challengeId, challenge } =
          await this.options.delegationRepository.mintRelayerVaultChallenge();
        coalesceOptions.challenge = challenge as `0x${string}`;
        coalesceOptions.onBatchAssertion = (assertion) => {
          this.options.delegationRepository.cacheRelayerVaultAssertion(
            challengeId,
            assertion,
          );
        };
      }

      const signed = await withCeremonyUiReason(
        EPasskeyPromptReason.ApproveTransaction,
        () =>
          withCoalescedSignDigest(
            signer,
            approveCopy,
            async () => {
              const [authEntry, feeDelegation, ...workDelegations] =
                await Promise.all([
                  needsUpgrade
                    ? this.signWalletUpgradeAuthorizationInner(
                        executionChainId,
                        {
                          account: viemAccount,
                          nonce: upgradeNonce,
                          contractAddress: upgradeContract,
                        },
                      )
                    : Promise.resolve(undefined),
                  this.createAndSignExactCalldataDelegation({
                    smartAccount: paymentSmartAccount,
                    delegate: paymentCapabilities.targetAddress,
                    target: paymentToken,
                    value: 0n,
                    callData: feeCalldata,
                    chainIdNumber: paymentChainIdNumber,
                  }),
                  ...workItems.map((item) =>
                    this.createAndSignExactCalldataDelegation({
                      smartAccount: executionSmartAccount,
                      delegate: executionCapabilities.targetAddress,
                      target: item.to,
                      value: item.value ?? 0n,
                      callData: (item.data || "0x") as Hex,
                      chainIdNumber: executionChainIdNumber,
                    }),
                  ),
                ]);
              return { authEntry, feeDelegation, workDelegations };
            },
            coalesceOptions,
          ),
      );

      if (signed.authEntry) {
        authorizationList = [signed.authEntry];
      } else if (needsUpgrade) {
        throw new Error(
          "EIP-7702 wallet upgrade was required but no authorization was signed",
        );
      }
      let feeDelegation = signed.feeDelegation;
      const workDelegations = signed.workDelegations;

      const buildParams = (
        feeSig: unknown,
        feeAmount: bigint,
        contexts?: Record<string, string>,
      ): IRelayer7710Params[] => {
        const feeData = HexStringCompat(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [paymentCapabilities.feeCollector, feeAmount],
          }),
        );
        const paymentKey = paymentChainId;
        const executionKey = executionChainId;
        return [
          {
            chainId: paymentChainIdNumber.toString(10),
            transactions: [
              {
                permissionContext: [toRelayerJson(feeSig)],
                executions: [
                  {
                    target: paymentToken,
                    value: "0",
                    data: feeData as HexString,
                  },
                ],
              },
            ],
            ...(contexts?.[paymentKey]
              ? { context: contexts[paymentKey] }
              : {}),
            memo,
            delegationSecret,
            ...(destinationUrl ? { destinationUrl } : {}),
          },
          {
            chainId: executionChainIdNumber.toString(10),
            transactions: workItems.map((item, index) => {
              const value = item.value ?? 0n;
              return {
                permissionContext: [toRelayerJson(workDelegations[index])],
                executions: [
                  {
                    target: item.to,
                    value: value === 0n ? "0" : `0x${value.toString(16)}`,
                    data: (item.data || "0x") as HexString,
                  },
                ],
              };
            }),
            ...(authorizationList?.length
              ? { authorizationList }
              : {}),
            ...(contexts?.[executionKey]
              ? { context: contexts[executionKey] }
              : {}),
            memo,
            delegationSecret,
            ...(destinationUrl ? { destinationUrl } : {}),
          },
        ];
      };

      let params = buildParams(feeDelegation, feeAtoms);
      let estimate =
        await this.options.relayerRepository.estimate7710TransactionMultichain(
          paymentChain.relayerUrl,
          params,
        );

      if (
        estimate.success &&
        estimate.requiredPaymentAmount &&
        tokenAmountFromAtomString(estimate.requiredPaymentAmount) > feeAtoms
      ) {
        feeAtoms = tokenAmountFromAtomString(estimate.requiredPaymentAmount);
        const paymentTokenMeta = paymentCapabilities.tokens.find(
          (token) =>
            String(token.address).toLowerCase() ===
            String(paymentToken).toLowerCase(),
        );
        const feeDecimals = paymentTokenMeta?.decimals ?? 6;
        if (onFinalFeeRequired) {
          await onFinalFeeRequired({
            feeAtoms,
            feeFormatted: formatUnits(feeAtoms, feeDecimals),
            paymentToken,
          });
        }
        const nextFeeCalldata = HexStringCompat(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [paymentCapabilities.feeCollector, feeAtoms],
          }),
        );
        const adjustCopy = adjustFeeCeremony();
        feeDelegation = await withCeremonyUiReason(
          EPasskeyPromptReason.AdjustFee,
          () =>
            withCoalescedSignDigest(signer, adjustCopy, () =>
              this.createAndSignExactCalldataDelegation({
                smartAccount: paymentSmartAccount,
                delegate: paymentCapabilities.targetAddress,
                target: paymentToken,
                value: 0n,
                callData: nextFeeCalldata,
                chainIdNumber: paymentChainIdNumber,
              }),
            ),
        );
        params = buildParams(feeDelegation, feeAtoms);
      }

      if (!estimate.success) {
        throw new Error(
          estimate.error ?? "relayer_estimate7710TransactionMultichain failed",
        );
      }

      if (!retainDisplayDuringSubmit) {
        await this.options.owsProvider.hideDisplay();
      } else {
        onAwaitingConfirmation?.();
      }

      params = buildParams(
        feeDelegation,
        feeAtoms,
        estimate.contextByChainId,
      );
      const taskIds =
        await this.options.relayerRepository.send7710TransactionMultichain(
          paymentChain.relayerUrl,
          params,
        );

      try {
        const hashes = await Promise.all(
          taskIds.map((taskId) =>
            this.pollUntilTerminal(paymentChain.relayerUrl, taskId),
          ),
        );
        if (authorizationList?.length) {
          await this.options.chainRepository.setWalletUpgraded(
            executionChainId,
            eoa,
            true,
          );
        }
        // Return the execution-chain hash (second task when payment ≠ execution).
        const executionHash =
          hashes[hashes.length - 1] ?? hashes[0]!;
        return {
          relayerTransactionId: taskIds[taskIds.length - 1] ?? taskIds[0]!,
          transactionHash: executionHash,
        };
      } catch (pollError) {
        if (authorizationList?.length) {
          await this.options.chainRepository.setWalletUpgraded(
            executionChainId,
            eoa,
            false,
          );
        }
        throw pollError;
      }
    } catch (error) {
      if (!retainDisplayDuringSubmit) {
        await this.options.owsProvider.hideDisplay();
      }
      throw error;
    }
  }

  private createExactCalldataDelegation(
    args: ExactCalldataDelegationArgs,
  ): ReturnType<typeof createDelegation> {
    const { smartAccount, delegate, target, value, callData } = args;
    const salt = randomSalt32();
    const selector = methodSelector(callData);

    return createDelegation({
      to: getAddress(delegate),
      from: smartAccount.address,
      environment: smartAccount.environment,
      salt,
      scope: {
        type: ScopeType.FunctionCall,
        targets: [getAddress(target)],
        selectors: [selector],
        exactCalldata: { calldata: callData },
        valueLte: { maxValue: value },
      },
    });
  }

  /**
   * Empty-calldata activation work for EIP-7702. Must not use
   * {@link ScopeType.FunctionCall}: AllowedMethodsEnforcer requires ≥4 bytes
   * of calldata (`invalid-execution-data-length` on `0x`).
   * NativeTokenTransferAmount + exactCalldata `0x` is the kit's intended
   * empty-call path (no AllowedMethods).
   */
  private createActivationNoOpDelegation(
    args: ActivationNoOpDelegationArgs,
  ): ReturnType<typeof createDelegation> {
    const { smartAccount, delegate } = args;
    return createDelegation({
      to: getAddress(delegate),
      from: smartAccount.address,
      environment: smartAccount.environment,
      salt: randomSalt32(),
      scope: {
        type: ScopeType.NativeTokenTransferAmount,
        maxAmount: 0n,
        exactCalldata: { calldata: EMPTY_CALLDATA },
      },
    });
  }

  private createUnsignedExactCalldataDelegation(
    args: ExactCalldataDelegationArgs,
  ): unknown {
    const delegation = this.createExactCalldataDelegation(args);
    return {
      ...delegation,
      signature: PLACEHOLDER_DELEGATION_SIGNATURE_65_ZERO,
    };
  }

  private createUnsignedActivationNoOpDelegation(
    args: ActivationNoOpDelegationArgs,
  ): unknown {
    const delegation = this.createActivationNoOpDelegation(args);
    return {
      ...delegation,
      signature: PLACEHOLDER_DELEGATION_SIGNATURE_65_ZERO,
    };
  }

  private async createAndSignExactCalldataDelegation(
    args: ExactCalldataDelegationArgs,
  ): Promise<unknown> {
    const { smartAccount } = args;
    const delegation = this.createExactCalldataDelegation(args);

    // Callers must already have the flyout open (SignHelper.withDisplay for
    // eth_sendTransaction, plus sendViaRelayer.ensureDisplay for size). Do not
    // call ensureDisplay here: parallel requestDisplay awaits stagger the two
    // signDelegation → signDigest paths and the second signer RPC cancels the
    // first Confirm UI (`ceremonyCancelled`). withCeremonyUiReason only sets
    // Confirm copy — it does not open/close display and awaits this method.
    const signature = await smartAccount.signDelegation({ delegation });
    return { ...delegation, signature };
  }

  private async createAndSignActivationNoOpDelegation(
    args: ActivationNoOpDelegationArgs,
  ): Promise<unknown> {
    const { smartAccount } = args;
    const delegation = this.createActivationNoOpDelegation(args);
    const signature = await smartAccount.signDelegation({ delegation });
    return { ...delegation, signature };
  }

  async getViemAccount(
    addressOverride?: EVMAccountAddress,
  ): Promise<LocalAccount> {
    const signer = await this.options.owsProvider.getSigner();
    const address =
      addressOverride ??
      signer.getCachedAddress?.() ??
      loadCachedEvmAddress() ??
      undefined;
    const publicKey =
      signer.getLastPublicKeyData?.()?.secp256k1PublicKey ??
      loadCachedSecp256k1PublicKey() ??
      undefined;
    const account = await toViemLocalAccount(signer, {
      ...(address ? { address } : {}),
      ...(publicKey ? { publicKey } : {}),
    });
    return account;
  }

  private async pollUntilTerminal(
    relayerUrl: string,
    taskId: RelayerTransactionId,
  ): Promise<EVMTransactionHash> {
    let lastHash: EVMTransactionHash | undefined;

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i += 1) {
      const status = await this.options.relayerRepository.getStatus(
        relayerUrl,
        taskId,
      );
      // 110: top-level `hash`; 200: `receipt.transactionHash` (mapped in getStatus).
      if (status.hash) {
        lastHash = status.hash;
      }

      if (status.status === 200) {
        if (status.hash) return status.hash;
        if (lastHash) return lastHash;
        throw new Error(
          "Relayer reported confirmed (200) without a transaction hash",
        );
      }
      if (status.status === 400 || status.status === 500) {
        throw new Error(
          status.message ?? `Relayer task failed with status ${status.status}`,
        );
      }
      await sleep(POLL_MS);
    }

    if (lastHash) {
      return lastHash;
    }
    throw new Error("Timed out waiting for relayer transaction status");
  }

  private async readCodeUpgradeStatus(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<IWalletUpgradeStatus> {
    const client = this.options.blockchain.getPublicClient(chainId);
    const code = await client.getCode({ address });
    if (!code || code === "0x") {
      return { upgraded: false };
    }

    let impl = STATELESS_DELEGATOR_IMPL.toLowerCase();
    try {
      const env = getSmartAccountsEnvironment(Number(BigInt(chainId)));
      impl = env.implementations.EIP7702StatelessDeleGatorImpl.toLowerCase();
    } catch {
      // keep hardcoded fallback
    }

    const normalized = code.toLowerCase();
    // EIP-7702 designator only: 0xef0100 || implementation address.
    // Do not substring-match the impl inside arbitrary bytecode — that can
    // false-positive and skip authorization on a chain that is not upgraded.
    if (!(normalized.startsWith("0xef0100") && normalized.length >= 48)) {
      return { upgraded: false };
    }
    const delegated = `0x${normalized.slice(8, 48)}`;
    if (delegated !== impl) {
      return { upgraded: false };
    }
    return {
      upgraded: true,
      codeAddress: EVMContractAddress(getAddress(delegated)),
    };
  }

  private async requireRelayerChain(chainId: EVMChainId) {
    const chain = await this.options.chainRepository.get(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    if (!chain.useRelayer) {
      throw new Error(`Chain ${chainId} does not support the 1Shot relayer`);
    }
    return chain;
  }

  /**
   * Unsigned multichain estimate: fee on payment chain, ExactCalldata work on
   * execution chain (used when Arc pays for a Base send, etc.).
   */
  private async quotePaymentCrossChain(args: {
    owner: EVMAccountAddress;
    executionChainId: EVMChainId;
    payment: IRelayerPayment;
    workItems: ITransactionWork[];
    seedFeeAtoms: TokenAmount;
    paymentCapabilities: Awaited<
      ReturnType<IOneshotRelayerRepository["getCapabilities"]>
    >;
  }): Promise<
    Awaited<ReturnType<IOneshotRelayerRepository["estimate7710Transaction"]>>
  > {
    const {
      owner,
      executionChainId,
      payment,
      workItems,
      seedFeeAtoms,
      paymentCapabilities,
    } = args;
    const paymentChain = await this.requireRelayerChain(payment.paymentChainId);
    const executionChain = await this.requireRelayerChain(executionChainId);
    const executionCapabilities =
      await this.options.relayerRepository.getCapabilities(
        executionChain.relayerUrl,
        executionChainId,
      );

    const viemAccount = await this.getViemAccount(owner);
    const paymentChainIdNumber = Number(BigInt(payment.paymentChainId));
    const executionChainIdNumber = Number(BigInt(executionChainId));

    const paymentClient = this.options.blockchain.getPublicClient(
      payment.paymentChainId,
    );
    const executionClient =
      this.options.blockchain.getPublicClient(executionChainId);

    const [paymentSmartAccount, executionSmartAccount] = await Promise.all([
      toMetaMaskSmartAccount({
        client: paymentClient as never,
        implementation: Implementation.Stateless7702,
        address: owner,
        signer: { account: viemAccount },
      }),
      toMetaMaskSmartAccount({
        client: executionClient as never,
        implementation: Implementation.Stateless7702,
        address: owner,
        signer: { account: viemAccount },
      }),
    ]);

    const feeCalldata = HexStringCompat(
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [paymentCapabilities.feeCollector, seedFeeAtoms],
      }),
    );
    const feeDelegation = this.createUnsignedExactCalldataDelegation({
      smartAccount: paymentSmartAccount,
      delegate: paymentCapabilities.targetAddress,
      target: payment.paymentToken,
      value: 0n,
      callData: feeCalldata,
      chainIdNumber: paymentChainIdNumber,
    });

    const workDelegations = workItems.map((item) =>
      this.createUnsignedExactCalldataDelegation({
        smartAccount: executionSmartAccount,
        delegate: executionCapabilities.targetAddress,
        target: item.to,
        value: item.value ?? 0n,
        callData: (item.data || "0x") as Hex,
        chainIdNumber: executionChainIdNumber,
      }),
    );

    const paymentParams: IRelayer7710Params = {
      chainId: paymentChainIdNumber.toString(10),
      transactions: [
        {
          permissionContext: [toRelayerJson(feeDelegation)],
          executions: [
            {
              target: payment.paymentToken,
              value: "0",
              data: feeCalldata as HexString,
            },
          ],
        },
      ],
    };

    const executionParams: IRelayer7710Params = {
      chainId: executionChainIdNumber.toString(10),
      transactions: workItems.map((item, index) => {
        const value = item.value ?? 0n;
        return {
          permissionContext: [toRelayerJson(workDelegations[index])],
          executions: [
            {
              target: item.to,
              value: value === 0n ? "0" : `0x${value.toString(16)}`,
              data: (item.data || "0x") as HexString,
            },
          ],
        };
      }),
    };

    console.debug(
      "[business/TransactionUtils] quotePayment cross-chain estimate",
      {
        executionChainId,
        paymentChainId: payment.paymentChainId,
        paymentToken: payment.paymentToken,
        workCount: workItems.length,
      },
    );

    return this.options.relayerRepository.estimate7710TransactionMultichain(
      paymentChain.relayerUrl,
      [paymentParams, executionParams],
    );
  }

  /**
   * Unsigned Multichain estimate: fee on payment chain + ExactCalldata work on
   * each execution chain (combined into payment-chain entry when they match).
   */
  private async quotePaymentWorkMultichain(args: {
    owner: EVMAccountAddress;
    payment: IRelayerPayment;
    groups: Array<{ chainId: EVMChainId; work: ITransactionWork[] }>;
    seedFeeAtoms: TokenAmount;
    paymentCapabilities: Awaited<
      ReturnType<IOneshotRelayerRepository["getCapabilities"]>
    >;
  }): Promise<
    Awaited<ReturnType<IOneshotRelayerRepository["estimate7710Transaction"]>>
  > {
    const {
      owner,
      payment,
      groups,
      seedFeeAtoms,
      paymentCapabilities,
    } = args;
    const paymentChain = await this.requireRelayerChain(payment.paymentChainId);
    const paymentChainIdNumber = Number(BigInt(payment.paymentChainId));
    const viemAccount = await this.getViemAccount(owner);

    const paymentClient = this.options.blockchain.getPublicClient(
      payment.paymentChainId,
    );
    const paymentSmartAccount = await toMetaMaskSmartAccount({
      client: paymentClient as never,
      implementation: Implementation.Stateless7702,
      address: owner,
      signer: { account: viemAccount },
    });

    const feeCalldata = HexStringCompat(
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [paymentCapabilities.feeCollector, seedFeeAtoms],
      }),
    );
    const feeDelegation = this.createUnsignedExactCalldataDelegation({
      smartAccount: paymentSmartAccount,
      delegate: paymentCapabilities.targetAddress,
      target: payment.paymentToken,
      value: 0n,
      callData: feeCalldata,
      chainIdNumber: paymentChainIdNumber,
    });

    const workChainIds = groups.map((g) => g.chainId);
    const ordered = orderedActivationChainIds(
      workChainIds,
      payment.paymentChainId,
    );

    const params: IRelayer7710Params[] = await Promise.all(
      ordered.map(async (chainId) => {
        const isPayment = chainId === payment.paymentChainId;
        const group = groups.find((g) => g.chainId === chainId);
        const transactions: IRelayer7710Params["transactions"] = [];

        if (isPayment) {
          transactions.push({
            permissionContext: [toRelayerJson(feeDelegation)],
            executions: [
              {
                target: payment.paymentToken,
                value: "0",
                data: feeCalldata as HexString,
              },
            ],
          });
        }

        if (group) {
          const chain = await this.requireRelayerChain(chainId);
          const caps = await this.options.relayerRepository.getCapabilities(
            chain.relayerUrl,
            chainId,
          );
          const chainIdNumber = Number(BigInt(chainId));
          const client = this.options.blockchain.getPublicClient(chainId);
          const smartAccount = await toMetaMaskSmartAccount({
            client: client as never,
            implementation: Implementation.Stateless7702,
            address: owner,
            signer: { account: viemAccount },
          });
          for (const item of group.work) {
            const workDelegation = this.createUnsignedExactCalldataDelegation({
              smartAccount,
              delegate: caps.targetAddress,
              target: item.to,
              value: item.value ?? 0n,
              callData: (item.data || "0x") as Hex,
              chainIdNumber,
            });
            const value = item.value ?? 0n;
            transactions.push({
              permissionContext: [toRelayerJson(workDelegation)],
              executions: [
                {
                  target: item.to,
                  value: value === 0n ? "0" : `0x${value.toString(16)}`,
                  data: (item.data || "0x") as HexString,
                },
              ],
            });
          }
        }

        if (transactions.length === 0) {
          throw new Error(
            `quotePaymentWorkMultichain: no transactions for ${chainId}`,
          );
        }

        return {
          chainId: Number(BigInt(chainId)).toString(10),
          transactions,
        } satisfies IRelayer7710Params;
      }),
    );

    console.debug(
      "[business/TransactionUtils] quotePaymentMultichain unsigned estimate",
      {
        paymentChainId: payment.paymentChainId,
        paymentToken: payment.paymentToken,
        workChains: workChainIds,
        workCount: groups.reduce((n, g) => n + g.work.length, 0),
      },
    );

    return this.options.relayerRepository.estimate7710TransactionMultichain(
      paymentChain.relayerUrl,
      params,
    );
  }

  /**
   * Build unsigned (placeholder) or shell params for activation estimate.
   * Signed submit uses the coalesced ceremony path instead.
   */
  private async buildActivationParams(args: {
    eoa: EVMAccountAddress;
    upgradeChainIds: readonly EVMChainId[];
    payment: IRelayerPayment;
    feeAtoms: TokenAmount;
    signed: false;
  }): Promise<IRelayer7710Params[]> {
    const { eoa, upgradeChainIds, payment, feeAtoms } = args;
    const ordered = orderedActivationChainIds(
      upgradeChainIds,
      payment.paymentChainId,
    );
    const viemAccount = await this.getViemAccount(eoa);

    return Promise.all(
      ordered.map(async (chainId) => {
        const isPayment = chainId === payment.paymentChainId;
        const needsUpgrade = upgradeChainIds.some((id) =>
          id === chainId,
        );
        const chain = await this.requireRelayerChain(chainId);
        const capabilities =
          await this.options.relayerRepository.getCapabilities(
            chain.relayerUrl,
            chainId,
          );
        const chainIdNumber = Number(BigInt(chainId));
        const client = this.options.blockchain.getPublicClient(chainId);
        const smartAccount = await toMetaMaskSmartAccount({
          client: client as never,
          implementation: Implementation.Stateless7702,
          address: eoa,
          signer: { account: viemAccount },
        });

        const transactions: IRelayer7710Params["transactions"] = [];

        if (isPayment) {
          const feeCalldata = HexStringCompat(
            encodeFunctionData({
              abi: erc20Abi,
              functionName: "transfer",
              args: [capabilities.feeCollector, feeAtoms],
            }),
          );
          const feeDelegation = this.createUnsignedExactCalldataDelegation({
            smartAccount,
            delegate: capabilities.targetAddress,
            target: payment.paymentToken,
            value: 0n,
            callData: feeCalldata,
            chainIdNumber,
          });
          transactions.push({
            permissionContext: [toRelayerJson(feeDelegation)],
            executions: [
              {
                target: payment.paymentToken,
                value: "0",
                data: feeCalldata as HexString,
              },
            ],
          });
        }

        if (needsUpgrade) {
          const workDelegation = this.createUnsignedActivationNoOpDelegation({
            smartAccount,
            delegate: capabilities.targetAddress,
          });
          transactions.push({
            permissionContext: [toRelayerJson(workDelegation)],
            executions: [
              {
                target: ACTIVATION_NOOP_TARGET,
                value: "0",
                data: EMPTY_CALLDATA as HexString,
              },
            ],
          });
        }

        let authorizationList: IRelayerAuthorizationEntry[] | undefined;
        if (needsUpgrade) {
          let contractAddress: `0x${string}` = STATELESS_DELEGATOR_IMPL;
          try {
            const env = getSmartAccountsEnvironment(chainIdNumber);
            contractAddress = getAddress(
              env.implementations.EIP7702StatelessDeleGatorImpl,
            );
          } catch {
            // keep hardcoded fallback
          }
          const nonce = await client.getTransactionCount({
            address: getAddress(eoa),
            blockTag: "pending",
          });
          authorizationList = [
            {
              address: contractAddress,
              chainId: chainIdNumber,
              nonce,
              r: PLACEHOLDER_AUTH_R,
              s: PLACEHOLDER_AUTH_S,
              yParity: 0,
            },
          ];
        }

        return {
          chainId: chainIdNumber.toString(10),
          transactions,
          ...(authorizationList ? { authorizationList } : {}),
        } satisfies IRelayer7710Params;
      }),
    );
  }
}

function approveTransactionCeremony(includeUpgrade: boolean): CeremonyUiParams {
  const prompts = styleController.get().copy.passkeyPrompt;
  return {
    explanationHeader: prompts.approveTransaction.title,
    explanationText: includeUpgrade
      ? `${prompts.approveTransaction.body} This includes a one-time wallet upgrade authorization.`
      : prompts.approveTransaction.body,
  };
}

function adjustFeeCeremony(): CeremonyUiParams {
  const prompts = styleController.get().copy.passkeyPrompt;
  return {
    explanationHeader: prompts.adjustFee.title,
    explanationText: prompts.adjustFee.body,
  };
}

function shouldUseActivationMultichain(
  upgradeChainIds: readonly EVMChainId[],
  paymentChainId: EVMChainId,
): boolean {
  if (upgradeChainIds.length !== 1) return true;
  return upgradeChainIds[0]! !== paymentChainId;
}

/** Fee/payment chain first, then remaining upgrade/work chains. */
function orderedActivationChainIds(
  upgradeChainIds: readonly EVMChainId[],
  paymentChainId: EVMChainId,
): EVMChainId[] {
  const ordered: EVMChainId[] = [paymentChainId];
  const seen = new Set<EVMChainId>([paymentChainId]);
  for (const chainId of upgradeChainIds) {
    if (seen.has(chainId)) continue;
    seen.add(chainId);
    ordered.push(chainId);
  }
  return ordered;
}

function normalizeWorkByChain(
  workByChain: readonly {
    chainId: EVMChainId;
    work: ITransactionWork | ITransactionWork[];
  }[],
): Array<{ chainId: EVMChainId; work: ITransactionWork[] }> {
  const byChain = new Map<EVMChainId, ITransactionWork[]>();
  for (const entry of workByChain) {
    const items = Array.isArray(entry.work) ? entry.work : [entry.work];
    if (items.length === 0) continue;
    const existing = byChain.get(entry.chainId);
    if (existing) {
      existing.push(...items);
    } else {
      byChain.set(entry.chainId, [...items]);
    }
  }
  return [...byChain.entries()].map(([chainId, work]) => ({ chainId, work }));
}

function methodSelector(callData: Hex): Hex {
  if (callData.length >= 10) {
    return callData.slice(0, 10) as Hex;
  }
  // FunctionCall + AllowedMethodsEnforcer needs ≥4 calldata bytes. Empty
  // activation work must use NativeTokenTransferAmount instead (see
  // createActivationNoOpDelegation). This fallback is only a last resort.
  return "0x00000000";
}

function randomSalt32(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}

let cachedDelegationBinding: string | undefined;

/**
 * Stable per-browser binding value for `relayer_send7710Transaction`.
 * Kept out of localStorage/sessionStorage (XSS-readable by default scrapers);
 * IndexedDB + in-memory cache. Migrates the legacy localStorage key once.
 */
async function loadOrCreateDelegationBinding(): Promise<string> {
  if (cachedDelegationBinding && cachedDelegationBinding.length >= 10) {
    return cachedDelegationBinding;
  }

  try {
    const legacy = localStorage.getItem(LEGACY_DELEGATION_SECRET_KEY);
    if (legacy && legacy.length >= 10) {
      await idbSetString(DELEGATION_BINDING_IDB_KEY, legacy);
      localStorage.removeItem(LEGACY_DELEGATION_SECRET_KEY);
      cachedDelegationBinding = legacy;
      return legacy;
    }
  } catch {
    // localStorage may be unavailable
  }

  try {
    const existing = await idbGetString(DELEGATION_BINDING_IDB_KEY);
    if (existing && existing.length >= 10) {
      cachedDelegationBinding = existing;
      return existing;
    }
    const next = crypto.randomUUID();
    await idbSetString(DELEGATION_BINDING_IDB_KEY, next);
    cachedDelegationBinding = next;
    return next;
  } catch {
    const fallback = crypto.randomUUID();
    cachedDelegationBinding = fallback;
    return fallback;
  }
}

function buildMemo(wallet: EVMAccountAddress, host: string): string {
  const memo = JSON.stringify({ wallet: String(wallet), host });
  return memo.length <= 256 ? memo : memo.slice(0, 256);
}

function toRelayerJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  if (value instanceof Uint8Array) {
    return `0x${Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  if (Array.isArray(value)) return value.map(toRelayerJson);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toRelayerJson(v);
    }
    return out;
  }
  return value;
}

function HexStringCompat(value: string): Hex {
  return value as Hex;
}

function yParityFromSignedAuthorization(signed: {
  yParity?: number | undefined;
  v?: bigint | number | undefined;
}): 0 | 1 {
  if (signed.yParity === 0 || signed.yParity === 1) {
    return signed.yParity;
  }
  if (signed.v !== undefined) {
    const v = Number(signed.v);
    if (v === 0 || v === 1) return v;
    if (v === 27 || v === 28) return (v - 27) as 0 | 1;
  }
  throw new Error(
    "EIP-7702 authorization missing yParity (relayer requires 0|1)",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}