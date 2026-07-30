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
import type {
  IOneshotRelayerRepository,
  IRelayer7710Params,
  IRelayerAuthorizationEntry,
  ISendTransactionResult,
} from "../../../interfaces/data/IOneshotRelayerRepository";
import type {
  IPaymentQuote,
  IPaymentTokenOption,
  ITransactionWork,
} from "../../../interfaces/business/ITransactionService";
import type { ITransactionUtils } from "../../../interfaces/business/utils/ITransactionUtils";
import type { ITransactionUtils as IPresentationTransactionUtils } from "../../../interfaces/utils/ITransactionUtils";
import type { IOWSProvider } from "../../../interfaces/utils/IOWSProvider";
import { EPasskeyPromptReason } from "../../../types/enum/EPasskeyPromptReason";
import { idbGetString, idbSetString } from "../../../utils/idbStringStore";
import { withCeremonyUiReason } from "../../../../wallet/ceremonyUiOverrideStore";
import { withCoalescedSignDigest } from "../../../../wallet/withCoalescedSignDigest";
import {
  loadCachedEvmAddress,
  loadCachedSecp256k1PublicKey,
} from "../../../../storage";
import { styleController } from "../../../../style/styleController";

const STATELESS_DELEGATOR_IMPL =
  "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B" as const;

/** IndexedDB key for the client delegation-binding value (not localStorage). */
const DELEGATION_BINDING_IDB_KEY = "oneshot.dbind";
const LEGACY_DELEGATION_SECRET_KEY = "oneshot.delegationSecret";
const POLL_MS = 1000;
const MAX_POLL_ATTEMPTS = 180;

export type TransactionUtilsOptions = {
  chainRepository: IChainRepository;
  relayerRepository: IOneshotRelayerRepository;
  blockchain: IBlockchainProvider;
  /** Presentation helpers (host domain for relayer memo). */
  presentationTransactionUtils: IPresentationTransactionUtils;
  owsProvider: IOWSProvider;
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
    const cached = await this.options.chainRepository.getWalletUpgraded(
      chainId,
      address,
    );
    if (cached === true) return false;
    if (cached === false) return true;

    const upgraded = await this.isCodeUpgraded(chainId, address);
    await this.options.chainRepository.setWalletUpgraded(
      chainId,
      address,
      upgraded,
    );
    return !upgraded;
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
    preferredToken?: EVMAccountAddress,
  ): Promise<IPaymentQuote> {
    const chain = await this.requireRelayerChain(chainId);
    const capabilities = await this.options.relayerRepository.getCapabilities(
      chain.relayerUrl,
      chainId,
    );

    const client = this.options.blockchain.getPublicClient(chainId);
    const tokens: IPaymentTokenOption[] = await Promise.all(
      capabilities.tokens.map(async (token) => {
        let balance = 0n;
        try {
          balance = await client.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [owner],
          });
        } catch {
          balance = 0n;
        }
        return { ...token, balance };
      }),
    );

    const selected = pickPaymentToken(tokens, preferredToken);
    if (!selected) {
      throw new Error("No relayer payment token with a positive balance");
    }

    // Confirm UI uses a conservative mock (≥ typical $0.01 minFee). The real fee
    // comes from relayer_estimate7710Transaction at submit — not getFeeData
    // (whose minFee is a human decimal string, not atoms).
    const feeAtoms = parseUnits("0.01", selected.decimals);

    return {
      tokens,
      selectedToken: selected.address,
      feeAtoms,
      feeFormatted: formatUnits(feeAtoms, selected.decimals),
      feeCollector: capabilities.feeCollector,
      targetAddress: capabilities.targetAddress,
      minFee: feeAtoms,
    };
  }

  async sendViaRelayer(args: {
    chainId: EVMChainId;
    work: ITransactionWork;
    paymentToken: EVMAccountAddress;
    feeAtoms: bigint;
    authorizationList?: IRelayerAuthorizationEntry[];
    relayerUrl: string;
  }): Promise<ISendTransactionResult> {
    const { chainId, work, paymentToken, relayerUrl } = args;
    let feeAtoms = args.feeAtoms;
    let authorizationList = args.authorizationList;

    const signer = await this.options.owsProvider.getSigner();
    const eoa =
      signer.getCachedAddress?.() ??
      loadCachedEvmAddress() ??
      (await signer.evm.getAccountAddress());

    const needsUpgrade =
      !authorizationList?.length &&
      (await this.needsWalletUpgrade(chainId, eoa));

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
      const workData = (work.data || "0x") as Hex;
      const workValue = work.value ?? 0n;

      const approveCopy = approveTransactionCeremony(needsUpgrade);

      // One passkey: optional EIP-7702 auth + fee + work delegations.
      const signed = await withCeremonyUiReason(
        EPasskeyPromptReason.ApproveTransaction,
        () =>
          withCoalescedSignDigest(
            signer,
            approveCopy,
            async () => {
              const [authEntry, feeDelegation, workDelegation] =
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
                  this.createAndSignExactCalldataDelegation({
                    smartAccount,
                    delegate: capabilities.targetAddress,
                    target: work.to,
                    value: workValue,
                    callData: workData,
                    chainIdNumber,
                  }),
                ]);
              return { authEntry, feeDelegation, workDelegation };
            },
            { minCalls: needsUpgrade ? 3 : 2 },
          ),
      );

      if (signed.authEntry) {
        authorizationList = [signed.authEntry];
      }
      let feeDelegation = signed.feeDelegation;
      const workDelegation = signed.workDelegation;

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
            {
              permissionContext: [toRelayerJson(workDelegation)],
              executions: [
                {
                  target: work.to,
                  value: workValue === 0n ? "0" : `0x${workValue.toString(16)}`,
                  data: workData as HexString,
                },
              ],
            },
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
        };
      };

      let params = buildParams(feeDelegation, feeAtoms);
      let estimate =
        await this.options.relayerRepository.estimate7710Transaction(
          relayerUrl,
          params,
        );

      if (
        estimate.success &&
        estimate.requiredPaymentAmount &&
        BigInt(estimate.requiredPaymentAmount) !== feeAtoms
      ) {
        feeAtoms = BigInt(estimate.requiredPaymentAmount);
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
        estimate =
          await this.options.relayerRepository.estimate7710Transaction(
            relayerUrl,
            params,
          );
      }

      if (!estimate.success) {
        throw new Error(
          estimate.error ?? "relayer_estimate7710Transaction failed",
        );
      }

      // Last passkey is done — collapse the flyout while submit/poll run.
      await this.options.owsProvider.hideDisplay();

      params = buildParams(feeDelegation, feeAtoms, estimate.context);
      const taskId = await this.options.relayerRepository.send7710Transaction(
        relayerUrl,
        params,
      );

      if (authorizationList?.length) {
        await this.options.chainRepository.setWalletUpgraded(chainId, eoa, true);
      }

      const hash = await this.pollUntilTerminal(relayerUrl, taskId);
      return {
        relayerTransactionId: taskId,
        transactionHash: hash,
      };
    } catch (error) {
      // ensureDisplay may have left the flyout open; hideDisplay is idempotent.
      await this.options.owsProvider.hideDisplay();
      throw error;
    }
  }

  private async createAndSignExactCalldataDelegation(args: {
    smartAccount: Awaited<ReturnType<typeof toMetaMaskSmartAccount>>;
    delegate: EVMAccountAddress;
    target: EVMAccountAddress;
    value: bigint;
    callData: Hex;
    chainIdNumber: number;
  }): Promise<unknown> {
    const { smartAccount, delegate, target, value, callData } = args;
    const salt = randomSalt32();
    const selector = methodSelector(callData);

    const delegation = createDelegation({
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

    // Callers must already have the flyout open (SignHelper.withDisplay for
    // eth_sendTransaction, plus sendViaRelayer.ensureDisplay for size). Do not
    // call ensureDisplay here: parallel requestDisplay awaits stagger the two
    // signDelegation → signDigest paths and the second signer RPC cancels the
    // first Confirm UI (`ceremonyCancelled`). withCeremonyUiReason only sets
    // Confirm copy — it does not open/close display and awaits this method.
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

  private async isCodeUpgraded(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<boolean> {
    const client = this.options.blockchain.getPublicClient(chainId);
    const code = await client.getCode({ address });
    if (!code || code === "0x") return false;

    let impl = STATELESS_DELEGATOR_IMPL.toLowerCase();
    try {
      const env = getSmartAccountsEnvironment(Number(BigInt(chainId)));
      impl = env.implementations.EIP7702StatelessDeleGatorImpl.toLowerCase();
    } catch {
      // keep hardcoded fallback
    }

    const normalized = code.toLowerCase();
    // EIP-7702 designator: 0xef0100 || address
    if (normalized.startsWith("0xef0100") && normalized.length >= 48) {
      const delegated = `0x${normalized.slice(8, 48)}`;
      return delegated === impl;
    }
    return normalized.includes(impl.slice(2));
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

function pickPaymentToken(
  tokens: IPaymentTokenOption[],
  preferred?: EVMAccountAddress,
): IPaymentTokenOption | null {
  const withBalance = tokens.filter((t) => t.balance > 0n);
  if (preferred) {
    const match = withBalance.find(
      (t) => String(t.address).toLowerCase() === String(preferred).toLowerCase(),
    );
    if (match) return match;
  }
  const usdc = withBalance.find((t) => t.symbol.toUpperCase() === "USDC");
  if (usdc) return usdc;
  const usdt = withBalance.find((t) => t.symbol.toUpperCase() === "USDT");
  if (usdt) return usdt;
  return withBalance[0] ?? null;
}

function methodSelector(callData: Hex): Hex {
  if (callData.length >= 10) {
    return callData.slice(0, 10) as Hex;
  }
  // Empty / short calldata (e.g. plain ETH transfer): pin via exactCalldata alone.
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