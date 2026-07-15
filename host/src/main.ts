import { OWSProxy } from "@1shotapi/ows-provider";
import { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import {
  createPublicClient,
  custom,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  type Address,
} from "viem";
import "./styles.css";

const messageInput = document.getElementById("message-input") as HTMLTextAreaElement;
const signButton = document.getElementById("sign-button") as HTMLButtonElement;
const showWalletButton = document.getElementById(
  "show-wallet-button",
) as HTMLButtonElement;
const chainSelect = document.getElementById("chain-select") as HTMLSelectElement;
const chainRefreshButton = document.getElementById(
  "chain-refresh-button",
) as HTMLButtonElement;
const tokenAddressInput = document.getElementById(
  "token-address-input",
) as HTMLInputElement;
const checkBalanceButton = document.getElementById(
  "check-balance-button",
) as HTMLButtonElement;
const tokenBalanceOutput = document.getElementById(
  "token-balance-output",
) as HTMLPreElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const signatureOutput = document.getElementById("signature-output") as HTMLPreElement;
const walletContainer = document.getElementById("wallet-container")!;

const styleProductName = document.getElementById(
  "style-product-name",
) as HTMLInputElement;
const styleTagline = document.getElementById("style-tagline") as HTMLInputElement;
const styleConnectTitle = document.getElementById(
  "style-connect-title",
) as HTMLInputElement;
const styleConnectContinue = document.getElementById(
  "style-connect-continue",
) as HTMLInputElement;
const styleSetupTitle = document.getElementById(
  "style-setup-title",
) as HTMLInputElement;
const styleSetupCreate = document.getElementById(
  "style-setup-create",
) as HTMLInputElement;
const stylePrimary = document.getElementById("style-primary") as HTMLInputElement;
const stylePrimaryFg = document.getElementById(
  "style-primary-fg",
) as HTMLInputElement;
const styleBackground = document.getElementById(
  "style-background",
) as HTMLInputElement;
const styleForeground = document.getElementById(
  "style-foreground",
) as HTMLInputElement;
const styleRadius = document.getElementById("style-radius") as HTMLInputElement;
const styleDark = document.getElementById("style-dark") as HTMLInputElement;
const applyStyleButton = document.getElementById(
  "apply-style-button",
) as HTMLButtonElement;
const presetOceanButton = document.getElementById(
  "preset-ocean-button",
) as HTMLButtonElement;
const presetResetButton = document.getElementById(
  "preset-reset-button",
) as HTMLButtonElement;
const styleStatusEl = document.getElementById("style-status") as HTMLParagraphElement;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
}

function setStyleStatus(message: string, isError = false): void {
  styleStatusEl.textContent = message;
  styleStatusEl.classList.toggle("status--error", isError);
}

/** Canonical hex chain id for `<option value>` matching. */
function normalizeChainIdHex(value: string): EVMChainId {
  return EVMChainId(`0x${BigInt(value).toString(16)}`);
}

function setChainSelectValue(chainId: EVMChainId): void {
  const value = String(chainId);
  if ([...chainSelect.options].some((option) => option.value === value)) {
    chainSelect.value = value;
    return;
  }
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  chainSelect.append(option);
  chainSelect.value = value;
}

async function refreshChainFromWallet(proxy: OWSProxy): Promise<EVMChainId> {
  const chainId = normalizeChainIdHex(
    await proxy.ethereum.request({ method: "eth_chainId" }),
  );
  setChainSelectValue(chainId);
  return chainId;
}

function createPublicClientFromProxy(proxy: OWSProxy) {
  return createPublicClient({
    transport: custom(proxy.ethereum),
  });
}

async function resolveAccount(proxy: OWSProxy): Promise<EVMAccountAddress> {
  let accounts = await proxy.ethereum.request({ method: "eth_accounts" });
  if (accounts.length === 0) {
    accounts = await proxy.ethereum.request({ method: "eth_requestAccounts" });
  }
  const account = accounts[0];
  if (!account) {
    throw new Error("No account returned from wallet");
  }
  return account;
}

function readStyleForm(): Record<string, unknown> {
  const theme: Record<string, string> = {};
  const primary = stylePrimary.value.trim();
  const primaryForeground = stylePrimaryFg.value.trim();
  const background = styleBackground.value.trim();
  const foreground = styleForeground.value.trim();
  const radius = styleRadius.value.trim();
  if (primary) theme.primary = primary;
  if (primaryForeground) theme.primaryForeground = primaryForeground;
  if (background) theme.background = background;
  if (foreground) theme.foreground = foreground;
  if (radius) theme.radius = radius;

  const copy: Record<string, unknown> = {};
  const productName = styleProductName.value.trim();
  const tagline = styleTagline.value.trim();
  const connectTitle = styleConnectTitle.value.trim();
  const connectContinue = styleConnectContinue.value.trim();
  const setupTitle = styleSetupTitle.value.trim();
  const setupCreate = styleSetupCreate.value.trim();
  if (productName) copy.productName = productName;
  if (tagline) copy.tagline = tagline;
  const connect: Record<string, string> = {};
  if (connectTitle) connect.title = connectTitle;
  if (connectContinue) connect.continueLabel = connectContinue;
  if (Object.keys(connect).length > 0) copy.connect = connect;
  const walletSetup: Record<string, string> = {};
  if (setupTitle) walletSetup.title = setupTitle;
  if (setupCreate) walletSetup.createLabel = setupCreate;
  if (Object.keys(walletSetup).length > 0) copy.walletSetup = walletSetup;

  const payload: Record<string, unknown> = {};
  if (Object.keys(theme).length > 0) payload.theme = theme;
  if (Object.keys(copy).length > 0) payload.copy = copy;
  payload.dark = styleDark.checked;
  return payload;
}

function fillStyleForm(preset: {
  productName: string;
  tagline: string;
  connectTitle: string;
  connectContinue: string;
  setupTitle: string;
  setupCreate: string;
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  radius: string;
  dark: boolean;
}): void {
  styleProductName.value = preset.productName;
  styleTagline.value = preset.tagline;
  styleConnectTitle.value = preset.connectTitle;
  styleConnectContinue.value = preset.connectContinue;
  styleSetupTitle.value = preset.setupTitle;
  styleSetupCreate.value = preset.setupCreate;
  stylePrimary.value = preset.primary;
  stylePrimaryFg.value = preset.primaryForeground;
  styleBackground.value = preset.background;
  styleForeground.value = preset.foreground;
  styleRadius.value = preset.radius;
  styleDark.checked = preset.dark;
}

async function applyStyle(proxy: OWSProxy): Promise<void> {
  applyStyleButton.disabled = true;
  setStyleStatus("Calling setStyle…");
  try {
    const options = readStyleForm();
    await proxy.rpc("setStyle", options);
    setStyleStatus("setStyle applied — open the wallet to see changes.");
  } catch (error) {
    setStyleStatus(
      error instanceof Error ? error.message : "setStyle failed",
      true,
    );
  } finally {
    applyStyleButton.disabled = false;
  }
}

async function main(): Promise<void> {
  setStatus("Connecting to wallet…");
  console.info("[oneshot-wallet-host] embedding Branding Layer", __WALLET_IFRAME_URL__);

  const proxy = await OWSProxy.create(walletContainer, __WALLET_IFRAME_URL__);

  try {
    const chainId = await refreshChainFromWallet(proxy);
    setStatus(`Wallet connected on ${chainId}. Enter a message and click Sign.`);
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Failed to read chain id",
      true,
    );
  }

  chainSelect.addEventListener("change", () => {
    void (async () => {
      const selected = EVMChainId(chainSelect.value as `0x${string}`);
      chainSelect.disabled = true;
      try {
        await proxy.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: selected }],
        });
        setStatus(`Switched to ${selected}`);
      } catch (error) {
        await refreshChainFromWallet(proxy).catch(() => undefined);
        setStatus(
          error instanceof Error ? error.message : "Chain switch failed",
          true,
        );
      } finally {
        chainSelect.disabled = false;
      }
    })();
  });

  chainRefreshButton.addEventListener("click", () => {
    void (async () => {
      chainRefreshButton.disabled = true;
      try {
        const chainId = await refreshChainFromWallet(proxy);
        setStatus(`Chain synced: ${chainId}`);
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Failed to refresh chain",
          true,
        );
      } finally {
        chainRefreshButton.disabled = false;
      }
    })();
  });

  signButton.addEventListener("click", () => {
    void handleSign(proxy);
  });

  checkBalanceButton.addEventListener("click", () => {
    void handleCheckBalance(proxy);
  });

  showWalletButton.addEventListener("click", () => {
    proxy.showWallet();
    setStatus("Wallet panel shown. Use × in the wallet to hide.");
  });

  applyStyleButton.addEventListener("click", () => {
    void applyStyle(proxy);
  });

  presetOceanButton.addEventListener("click", () => {
    fillStyleForm({
      productName: "Ocean Wallet",
      tagline: "Host setStyle preset",
      connectTitle: "Connect to Ocean",
      connectContinue: "Allow",
      setupTitle: "Welcome aboard",
      setupCreate: "Create Ocean account",
      primary: "oklch(0.45 0.18 250)",
      primaryForeground: "oklch(0.99 0 0)",
      background: "oklch(0.98 0.01 250)",
      foreground: "oklch(0.2 0.04 250)",
      radius: "0.75rem",
      dark: false,
    });
    void applyStyle(proxy);
  });

  presetResetButton.addEventListener("click", () => {
    fillStyleForm({
      productName: "1Shot Wallet",
      tagline: "Passkey-secured embedded wallet",
      connectTitle: "Connect wallet",
      connectContinue: "Continue",
      setupTitle: "Set up your wallet",
      setupCreate: "Create account",
      primary: "oklch(0.205 0 0)",
      primaryForeground: "oklch(0.985 0 0)",
      background: "oklch(1 0 0)",
      foreground: "oklch(0.145 0 0)",
      radius: "0.625rem",
      dark: false,
    });
    void applyStyle(proxy);
  });
}

async function handleSign(proxy: OWSProxy): Promise<void> {
  const message = messageInput.value.trim();
  if (!message) {
    setStatus("Enter a message to sign.", true);
    return;
  }

  signButton.disabled = true;
  signatureOutput.hidden = true;
  setStatus("Requesting accounts…");

  try {
    const account = await resolveAccount(proxy);

    setStatus("Approve the passkey prompt to sign…");

    const signature = await proxy.ethereum.request({
      method: "personal_sign",
      params: [message, account],
    });

    signatureOutput.textContent = signature;
    signatureOutput.hidden = false;
    setStatus(`Signed as ${account}`);
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Signing failed";
    setStatus(messageText, true);
  } finally {
    signButton.disabled = false;
  }
}

async function handleCheckBalance(proxy: OWSProxy): Promise<void> {
  const rawAddress = tokenAddressInput.value.trim();
  if (!isAddress(rawAddress)) {
    setStatus("Enter a valid ERC-20 contract address.", true);
    tokenBalanceOutput.hidden = true;
    return;
  }

  checkBalanceButton.disabled = true;
  tokenBalanceOutput.hidden = true;
  setStatus("Reading token balance…");

  try {
    const token = getAddress(rawAddress) as Address;
    const account = await resolveAccount(proxy);
    const owner = getAddress(account) as Address;
    const client = createPublicClientFromProxy(proxy);

    const [name, symbol, balance, decimals] = await Promise.all([
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "name",
      }),
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "symbol",
      }),
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
      }),
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);

    tokenBalanceOutput.textContent = [
      `Contract: ${token}`,
      `Account:  ${owner}`,
      `Name:     ${name}`,
      `Symbol:   ${symbol}`,
      `Balance:  ${formatUnits(balance, decimals)} ${symbol}`,
      `Raw:      ${balance.toString()}`,
    ].join("\n");
    tokenBalanceOutput.hidden = false;
    setStatus(`Balance for ${symbol}: ${formatUnits(balance, decimals)}`);
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Failed to read token balance",
      true,
    );
  } finally {
    checkBalanceButton.disabled = false;
  }
}

main().catch((error: unknown) => {
  console.error("[oneshot-wallet-host] failed to start", error);
  setStatus(
    error instanceof Error ? error.message : "Failed to connect to wallet",
    true,
  );
});
