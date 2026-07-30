import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { COSEPublicKey, CredentialId, OwsUserRejectedError } from "@1shotapi/ows-types";
import type { CachedRelayerVaultRepository } from "../lib/implementations/data/CachedRelayerVaultRepository";
import {
  isWalletCreated,
  loadCredentialId,
  saveCachedAddresses,
  saveCachedSecp256k1PublicKey,
  saveCosePublicKey,
  saveWalletCreated,
} from "../storage";
import { pushModal } from "./pushModal";
import type { WalletSetupChoice } from "./modalTypes";
import { useWalletSessionStore } from "./sessionStore";
import { needsFirstPartyPasskeyCreate } from "./passkeyCreateSupport";
import { createAccountViaFirstPartyTab } from "./createAccountHandoff";
import type { IPasskeyRegistrationResult } from "./registerCreateAccount";

export interface IUseWalletAuthParams {
  signerRef: RefObject<OWSSigner | null>;
  walletRef: RefObject<OWSWallet | null>;
  awaitSignerRef: RefObject<(() => Promise<OWSSigner>) | null>;
  credentialRepository: CachedRelayerVaultRepository;
}

export function useWalletAuth({
  signerRef,
  walletRef,
  awaitSignerRef,
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

  const adoptCreatedCredential = useCallback(
    async (credentialId: CredentialId, cosePublicKey: COSEPublicKey) => {
      console.info("[create-handoff] adoptCreatedCredential start", {
        credentialIdPrefix: credentialId.slice(0, 8),
        hasCosePublicKey: Boolean(cosePublicKey),
      });
      saveWalletCreated(credentialId);
      useWalletSessionStore.getState().setWalletCreated(true);
      const signer = signerRef.current;
      if (!signer) throw new Error("Signer not ready");
      // Unlock on this signer session (PRF get) — deferred from /create.
      await signer.getPublicKey({ credentialId });
      await refreshAddresses();
      // Relayer register — also deferred from /create (one assertion here).
      saveCosePublicKey(COSEPublicKey(cosePublicKey));
      await credentialRepository.registerPasskey(COSEPublicKey(cosePublicKey));
      try {
        await refreshCredentialCount();
      } catch (error: unknown) {
        console.warn(
          "[credentials] refresh after first-party create failed",
          error,
        );
      }
      setUnlocked(true);
      console.info("[create-handoff] adoptCreatedCredential unlocked + registered");
    },
    [
      credentialRepository,
      refreshAddresses,
      refreshCredentialCount,
      setUnlocked,
      signerRef,
    ],
  );

  /**
   * WebAuthn create only (no PRF unlock, no relayer). Used by first-party
   * `/create` so ceremonies finish on the original host after handoff.
   */
  const createPasskeyRegistrationOnly = useCallback(
    async (accountName?: string): Promise<IPasskeyRegistrationResult> => {
      const name =
        accountName ??
        (await promptPasskeyName());
      if (!name) {
        throw new OwsUserRejectedError("User cancelled passkey creation");
      }
      const signer = signerRef.current;
      if (!signer) throw new Error("Signer not ready");
      const created = await signer.createCredential(name, {
        rpName: "Open Wallet",
        userDisplayName: name,
        // Supported once @1shotapi/ows-signer(+utils/types) with deferKeyDerivation
        // is published; local Vite aliases sibling prf-wallet packages in the meantime.
        deferKeyDerivation: true,
      } as Parameters<OWSSigner["createCredential"]>[1]);
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
      saveCosePublicKey(created.cosePublicKey);
      // Do not unlock or register — opener adopts via handoff.
      return {
        credentialId,
        cosePublicKey: created.cosePublicKey,
      };
    },
    [promptPasskeyName, signerRef],
  );

  const createNewWallet = useCallback(
    async (accountName: string) => {
      if (needsFirstPartyPasskeyCreate()) {
        console.info("[create-handoff] diverting createNewWallet → /create");
        const { credentialId, cosePublicKey } =
          await createAccountViaFirstPartyTab();
        await adoptCreatedCredential(credentialId, cosePublicKey);
        return;
      }

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
      saveCosePublicKey(created.cosePublicKey);
      await credentialRepository.registerPasskey(created.cosePublicKey);
      useWalletSessionStore.getState().setWalletCreated(true);
      await refreshAddresses();
      setUnlocked(true);
    },
    [
      adoptCreatedCredential,
      credentialRepository,
      refreshAddresses,
      setUnlocked,
      signerRef,
    ],
  );

  const createNewWalletFromUi = useCallback(async () => {
    if (needsFirstPartyPasskeyCreate()) {
      console.info("[create-handoff] diverting createNewWalletFromUi → /create");
      const { credentialId, cosePublicKey } =
        await createAccountViaFirstPartyTab();
      await adoptCreatedCredential(credentialId, cosePublicKey);
      return;
    }

    const name = await promptPasskeyName();
    if (!name) {
      throw new OwsUserRejectedError("User cancelled passkey creation");
    }
    await createNewWallet(name);
  }, [adoptCreatedCredential, createNewWallet, promptPasskeyName]);

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
      // Unlock alone — callers that need the vault (ensureReady) recover
      // after this when the local cache is empty. Refresh buttons must not
      // nest recover inside unlock (that double-fires RelayerAuth).
      setUnlocked(true);
      return;
    }
    await loginWithPasskey();
  }, [
    loginWithPasskey,
    refreshAddresses,
    setUnlocked,
    signerRef,
  ]);

  const runSetupFlow = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) throw new Error("Wallet not ready");

    let choice: WalletSetupChoice = "cancel";
    const display = await wallet.requestDisplay();
    try {
      choice = await requestWalletSetupChoice();
      if (choice === "cancel") {
        throw new OwsUserRejectedError("User cancelled wallet setup");
      }
      if (choice === "login") {
        await loginWithPasskey();
        return;
      }
      // Import continues after this flyout is released.
      if (choice !== "import") {
        await createNewWalletFromUi();
      }
    } finally {
      await display.hide();
    }

    if (choice !== "import") {
      return;
    }

    const backupDisplay = await wallet.requestDisplay();
    try {
      const imported = await pushModal<boolean>(({ id, resolve, reject }) => ({
        id,
        kind: "importPrivateKey",
        resolve,
        reject,
      }));
      if (!imported) {
        throw new OwsUserRejectedError("User cancelled private key import");
      }
      setUnlocked(true);
      useWalletSessionStore.getState().setWalletCreated(true);
      await refreshAddresses();
    } finally {
      await backupDisplay.hide();
    }
  }, [
    createNewWalletFromUi,
    loginWithPasskey,
    refreshAddresses,
    requestWalletSetupChoice,
    setUnlocked,
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
        // Warm vault once after unlock when both local lists are empty.
        // Refresh / Credentials / Delegations call refreshFromRelayer themselves
        // and must not also hit this path via nested ensureReady.
        try {
          const [creds, dels] = await Promise.all([
            credentialRepository.list(),
            credentialRepository.listDelegations(),
          ]);
          if (creds.length === 0 && dels.length === 0) {
            await credentialRepository.refreshFromRelayer();
            await refreshCredentialCount();
          }
        } catch (error: unknown) {
          console.warn(
            "[credentials] recover after unlock failed (passkey may be unregistered)",
            error,
          );
        }
        return;
      }
      await runSetupFlow();
    })();

    try {
      await unlockInFlightRef.current;
    } finally {
      unlockInFlightRef.current = undefined;
    }
  }, [
    credentialRepository,
    refreshCredentialCount,
    runSetupFlow,
    unlockWithStoredCredential,
  ]);

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
    createNewWallet,
    createNewWalletFromUi,
    createPasskeyRegistrationOnly,
    ensureReady,
    ensureReadyRef,
    ensureOnboardedForSigning,
    onSigningAuthenticated,
    awaitSignerReady,
  };
}
