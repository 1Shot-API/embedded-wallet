import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { OwsUserRejectedError } from "@1shotapi/ows-types";
import type { CachedRelayerCredentialRepository } from "../credentials/CachedRelayerCredentialRepository";
import {
  isWalletCreated,
  loadCredentialId,
  saveCachedAddresses,
  saveCachedSecp256k1PublicKey,
  saveWalletCreated,
} from "../storage";
import type { IConfigProvider } from "../lib/interfaces/utils";
import { pushModal } from "./pushModal";
import type { WalletSetupChoice } from "./modalTypes";
import { useWalletSessionStore } from "./sessionStore";

export interface IUseWalletAuthParams {
  signerRef: RefObject<OWSSigner | null>;
  walletRef: RefObject<OWSWallet | null>;
  awaitSignerRef: RefObject<(() => Promise<OWSSigner>) | null>;
  configProvider: IConfigProvider;
  credentialRepository: CachedRelayerCredentialRepository;
}

export function useWalletAuth({
  signerRef,
  walletRef,
  awaitSignerRef,
  configProvider,
  credentialRepository,
}: IUseWalletAuthParams) {
  const unlockInFlightRef = useRef<Promise<void> | undefined>(undefined);

  const setUnlocked = useCallback((value: boolean) => {
    useWalletSessionStore.getState().setUnlocked(value);
  }, []);

  const refreshAddresses = useCallback(async () => {
    const signer = signerRef.current;
    if (!signer) return;
    const [evm, solana] = await Promise.all([
      signer.evm.getAccountAddress(),
      signer.solana.getAccountAddress(),
    ]);
    useWalletSessionStore.getState().setAddresses(evm, solana);
    saveCachedAddresses(evm, solana);
    const pk = signer.getLastPublicKeyData?.()?.secp256k1PublicKey;
    if (pk) {
      saveCachedSecp256k1PublicKey(pk);
    }
  }, [signerRef]);

  const refreshCredentialCount = useCallback(async () => {
    const listed = await credentialRepository.list();
    useWalletSessionStore.getState().setCredentialCount(listed.length);
  }, [credentialRepository]);

  const promptPasskeyName = useCallback((): Promise<string | null> => {
    return pushModal<string | null>(({ id, resolve }) => ({
      id,
      kind: "passkeyName",
      resolve,
    }));
  }, []);

  const requestWalletSetupChoice =
    useCallback((): Promise<WalletSetupChoice> => {
      return pushModal<WalletSetupChoice>(({ id, resolve }) => ({
        id,
        kind: "walletSetup",
        resolve,
      }));
    }, []);

  const loginWithPasskey = useCallback(async () => {
    const signer = signerRef.current;
    if (!signer) throw new Error("Signer not ready");
    const result = await signer.getPublicKey({ discoverable: true });
    const credentialId = result.credentialId ?? signer.getCredentialId();
    if (!credentialId) {
      throw new Error("Passkey login succeeded but credential id missing");
    }
    saveWalletCreated(credentialId);
    await refreshAddresses();
    try {
      await credentialRepository.refreshFromRelayer();
      await refreshCredentialCount();
    } catch (error: unknown) {
      console.warn(
        "[credentials] recover after login failed (passkey may be unregistered)",
        error,
      );
    }
    useWalletSessionStore.getState().setWalletCreated(true);
    setUnlocked(true);
  }, [
    credentialRepository,
    refreshAddresses,
    refreshCredentialCount,
    setUnlocked,
    signerRef,
  ]);

  const createNewWallet = useCallback(
    async (accountName: string) => {
      const signer = signerRef.current;
      if (!signer) throw new Error("Signer not ready");
      const created = await signer.createCredential(accountName, {
        rpName: "Open Wallet",
        userDisplayName: accountName,
      });
      const credentialId =
        created.credentialId ?? signer.getCredentialId();
      if (!credentialId) {
        throw new Error("Passkey created but credential id missing");
      }
      if (!created.cosePublicKey) {
        throw new Error(
          "Passkey created but authenticator public key missing — cannot register with relayer",
        );
      }
      saveWalletCreated(credentialId);
      await credentialRepository.registerPasskey(created.cosePublicKey);
      useWalletSessionStore.getState().setWalletCreated(true);
      await refreshAddresses();
      setUnlocked(true);
    },
    [credentialRepository, refreshAddresses, setUnlocked, signerRef],
  );

  const createNewWalletFromUi = useCallback(async () => {
    const name = await promptPasskeyName();
    if (!name) {
      throw new OwsUserRejectedError("User cancelled passkey creation");
    }
    await createNewWallet(name);
  }, [createNewWallet, promptPasskeyName]);

  const unlockWithStoredCredential = useCallback(async () => {
    const signer = signerRef.current;
    if (!signer) throw new Error("Signer not ready");
    const storedCredentialId = loadCredentialId();
    if (storedCredentialId) {
      const result = await signer.getPublicKey({
        credentialId: storedCredentialId,
      });
      const credentialId = result.credentialId ?? signer.getCredentialId();
      if (!credentialId) {
        throw new Error("Passkey unlock succeeded but credential id missing");
      }
      saveWalletCreated(credentialId);
      useWalletSessionStore.getState().setWalletCreated(true);
      await refreshAddresses();
      try {
        const listed = await credentialRepository.list();
        if (listed.length === 0) {
          await credentialRepository.refreshFromRelayer();
          await refreshCredentialCount();
        }
      } catch (error: unknown) {
        console.warn(
          "[credentials] recover after unlock failed (passkey may be unregistered)",
          error,
        );
      }
      setUnlocked(true);
      return;
    }
    await loginWithPasskey();
  }, [
    credentialRepository,
    loginWithPasskey,
    refreshAddresses,
    refreshCredentialCount,
    setUnlocked,
    signerRef,
  ]);

  const runSetupFlow = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) throw new Error("Wallet not ready");
    const config = await configProvider.getConfig();
    const display = await wallet.requestDisplay(config.displayModalSize);
    try {
      const choice = await requestWalletSetupChoice();
      if (choice === "cancel") {
        throw new OwsUserRejectedError("User cancelled wallet setup");
      }
      if (choice === "login") {
        await loginWithPasskey();
        return;
      }
      await createNewWalletFromUi();
    } finally {
      await display.hide();
    }
  }, [
    configProvider,
    createNewWalletFromUi,
    loginWithPasskey,
    requestWalletSetupChoice,
    walletRef,
  ]);

  const ensureReadyImpl = useCallback(async () => {
    if (useWalletSessionStore.getState().unlocked) {
      return;
    }
    if (unlockInFlightRef.current) {
      await unlockInFlightRef.current;
      return;
    }

    unlockInFlightRef.current = (async () => {
      if (isWalletCreated()) {
        await unlockWithStoredCredential();
        return;
      }
      await runSetupFlow();
    })();

    try {
      await unlockInFlightRef.current;
    } finally {
      unlockInFlightRef.current = undefined;
    }
  }, [runSetupFlow, unlockWithStoredCredential]);

  const ensureReadyRef = useRef(ensureReadyImpl);
  useEffect(() => {
    ensureReadyRef.current = ensureReadyImpl;
  }, [ensureReadyImpl]);

  const awaitSignerReady = useCallback(async (): Promise<OWSSigner> => {
    const awaitSigner = awaitSignerRef.current;
    if (!awaitSigner) {
      throw new Error(
        "Signing Layer not started — wallet boot has not begun yet",
      );
    }
    return awaitSigner();
  }, [awaitSignerRef]);

  const ensureReady = useCallback(async () => {
    const awaitSigner = awaitSignerRef.current;
    if (!awaitSigner) {
      throw new Error(
        "Signing Layer not started — wallet boot has not begun yet",
      );
    }
    await awaitSigner();
    await ensureReadyRef.current();
  }, [awaitSignerRef]);

  const ensureOnboardedForSigning = useCallback(async () => {
    const awaitSigner = awaitSignerRef.current;
    if (!awaitSigner) {
      throw new Error(
        "Signing Layer not started — wallet boot has not begun yet",
      );
    }
    await awaitSigner();
    if (isWalletCreated()) {
      return;
    }
    await ensureReadyRef.current();
  }, [awaitSignerRef]);

  const onSigningAuthenticated = useCallback(async () => {
    await refreshAddresses();
    useWalletSessionStore.getState().setWalletCreated(true);
    setUnlocked(true);
  }, [refreshAddresses, setUnlocked]);

  return {
    setUnlocked,
    refreshAddresses,
    refreshCredentialCount,
    loginWithPasskey,
    createNewWalletFromUi,
    ensureReady,
    ensureReadyRef,
    ensureOnboardedForSigning,
    onSigningAuthenticated,
    awaitSignerReady,
  };
}
