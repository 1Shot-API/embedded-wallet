import type { OWSProxy } from "@1shotapi/ows-provider";
import { EVMChainId } from "@1shotapi/ows-types";
import { Core } from "@walletconnect/core";
import { WalletKit, type WalletKitTypes } from "@reown/walletkit";
import { getSdkError } from "@walletconnect/utils";
import {
  buildApprovedNamespaces,
  hexChainIdToDecimal,
  mergeProposalNamespaces,
} from "./namespaces";
import { REOWN_PROJECT_ID, walletMetadataForOrigin } from "./constants";

export type WalletConnectBridge = {
  pair: (uri: string) => Promise<void>;
  getActiveSessionCount: () => number;
};

type StatusFn = (message: string, isError?: boolean) => void;

function normalizeRequestParams(params: unknown): unknown[] | undefined {
  if (params == null) return undefined;
  if (Array.isArray(params)) return params;
  return [params];
}

function isUserRejected(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: number; name?: string; message?: string };
  if (err.code === 4001) return true;
  const hay = `${err.name ?? ""} ${err.message ?? ""}`.toLowerCase();
  return hay.includes("rejected") || hay.includes("denied");
}

/**
 * WalletConnect v2 (Reown WalletKit) ↔ OWSProxy EIP-1193 bridge.
 */
export async function startWalletConnectBridge(
  proxy: OWSProxy,
  setStatus: StatusFn,
): Promise<WalletConnectBridge> {
  const core = new Core({ projectId: REOWN_PROJECT_ID });
  const walletKit = await WalletKit.init({
    core,
    metadata: walletMetadataForOrigin(window.location.origin),
  });

  const emitToSessions = async (
    event: "accountsChanged" | "chainChanged",
    chainIdHex: string,
    data: unknown,
  ): Promise<void> => {
    const decimal = hexChainIdToDecimal(chainIdHex);
    const chainId = `eip155:${decimal}`;
    const sessions = Object.values(walletKit.getActiveSessions());
    await Promise.all(
      sessions.map(async (session) => {
        try {
          await walletKit.emitSessionEvent({
            topic: session.topic,
            event: { name: event, data },
            chainId,
          });
        } catch (error) {
          console.warn("[mobile/wc] emitSessionEvent failed", event, error);
        }
      }),
    );
  };

  let lastChainId = "0x1";
  try {
    lastChainId = String(
      await proxy.ethereum.request({ method: "eth_chainId" }),
    );
  } catch {
    // Branding may not be unlocked yet.
  }

  proxy.ethereum.on("chainChanged", (...params: unknown[]) => {
    const next = typeof params[0] === "string" ? params[0] : lastChainId;
    lastChainId = next;
    void emitToSessions("chainChanged", next, next);
  });

  proxy.ethereum.on("accountsChanged", (...params: unknown[]) => {
    const accounts = Array.isArray(params[0]) ? params[0] : [];
    void emitToSessions("accountsChanged", lastChainId, accounts);
  });

  walletKit.on(
    "session_proposal",
    async (proposal: WalletKitTypes.SessionProposal) => {
      setStatus(
        `Session proposal from ${proposal.params.proposer.metadata.name}…`,
      );
      try {
        const accounts = (await proxy.ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];
        const address = accounts[0];
        if (!address) {
          throw new Error("No account available after connect");
        }

        const chainIdHex = String(
          await proxy.ethereum.request({ method: "eth_chainId" }),
        );
        lastChainId = chainIdHex;

        const namespaces = buildApprovedNamespaces({
          proposalNamespaces: mergeProposalNamespaces(
            proposal.params.requiredNamespaces,
            proposal.params.optionalNamespaces,
          ),
          address,
        });

        await walletKit.approveSession({
          id: proposal.id,
          namespaces,
        });
        setStatus(`Connected to ${proposal.params.proposer.metadata.name}`);
      } catch (error) {
        const reason = isUserRejected(error)
          ? getSdkError("USER_REJECTED")
          : getSdkError("USER_REJECTED_METHODS");
        try {
          await walletKit.rejectSession({
            id: proposal.id,
            reason,
          });
        } catch {
          // already gone
        }
        setStatus(
          error instanceof Error ? error.message : "Session proposal failed",
          true,
        );
      }
    },
  );

  walletKit.on(
    "session_request",
    async (event: WalletKitTypes.SessionRequest) => {
      const { topic, params, id } = event;
      const { request, chainId } = params;
      setStatus(`Request: ${request.method}`);

      try {
        if (chainId?.startsWith("eip155:")) {
          const requestedHex = `0x${Number(
            chainId.slice("eip155:".length),
          ).toString(16)}`;
          const current = String(
            await proxy.ethereum.request({ method: "eth_chainId" }),
          );
          if (current.toLowerCase() !== requestedHex.toLowerCase()) {
            await proxy.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [
                { chainId: EVMChainId(requestedHex as `0x${string}`) },
              ],
            });
            lastChainId = requestedHex;
          }
        }

        const result = await proxy.ethereum.request({
          method: request.method,
          params: normalizeRequestParams(request.params) as never,
        });
        await walletKit.respondSessionRequest({
          topic,
          response: {
            id,
            jsonrpc: "2.0",
            result,
          },
        });
        setStatus(`Completed ${request.method}`);
      } catch (error) {
        const err = error as { code?: number; message?: string };
        await walletKit.respondSessionRequest({
          topic,
          response: {
            id,
            jsonrpc: "2.0",
            error: {
              code: typeof err.code === "number" ? err.code : 5000,
              message:
                err.message ||
                (error instanceof Error ? error.message : String(error)),
            },
          },
        });
        setStatus(err.message || "Request failed", true);
      }
    },
  );

  walletKit.on("session_delete", () => {
    const count = Object.keys(walletKit.getActiveSessions()).length;
    setStatus(
      count > 0
        ? `${count} active WalletConnect session(s)`
        : "No active sessions",
    );
  });

  return {
    async pair(uri: string) {
      const trimmed = uri.trim();
      if (!trimmed.startsWith("wc:")) {
        throw new Error("URI must start with wc:");
      }
      setStatus("Pairing…");
      await walletKit.pair({ uri: trimmed });
      setStatus("Waiting for session proposal…");
    },
    getActiveSessionCount() {
      return Object.keys(walletKit.getActiveSessions()).length;
    },
  };
}

export function readWalletConnectUriFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("uri");
  if (fromQuery?.startsWith("wc:")) {
    return fromQuery;
  }
  if (fromQuery) {
    try {
      const decoded = decodeURIComponent(fromQuery);
      if (decoded.startsWith("wc:")) return decoded;
    } catch {
      // ignore
    }
  }

  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("wc:")) {
    return hash;
  }
  const hashParams = new URLSearchParams(hash);
  const fromHash = hashParams.get("uri");
  if (fromHash?.startsWith("wc:")) {
    return fromHash;
  }
  return null;
}
