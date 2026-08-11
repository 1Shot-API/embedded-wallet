import {
  CONTENT_SOURCE,
  PROTOCOL_VERSION,
  PROVIDER_ICON_DATA_URI,
} from "../src/shared/constants";
import {
  isInpageMessage,
  type ContentToInpageConfig,
  type ContentToInpageEvent,
  type ContentToInpageResponse,
  type ExtEip1193EventMessage,
  type ExtEip1193RequestMessage,
  type ExtEip1193ResponseMessage,
  type ExtRuntimeMessage,
} from "../src/shared/protocol";
import { getSettings } from "../src/shared/storage";

const MARKER = "data-oneshot-content";
const BRIDGE_FLAG = "__ONESHOT_CONTENT_BRIDGE__";

type BridgeGlobal = typeof globalThis & {
  [BRIDGE_FLAG]?: boolean;
};

function postToPage(
  message: ContentToInpageResponse | ContentToInpageEvent | ContentToInpageConfig,
): void {
  window.postMessage(message, "*");
}

async function sendConfig(): Promise<void> {
  const settings = await getSettings();
  postToPage({
    source: CONTENT_SOURCE,
    version: PROTOCOL_VERSION,
    type: "config",
    preferOneshot: settings.preferOneshot,
    iconUrl: PROVIDER_ICON_DATA_URI,
  });
}

function installBridge(): void {
  const g = globalThis as BridgeGlobal;
  if (g[BRIDGE_FLAG]) {
    return;
  }
  g[BRIDGE_FLAG] = true;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!isInpageMessage(event.data)) return;

    if (event.data.type === "ready") {
      void sendConfig();
      return;
    }

    if (event.data.type !== "request") return;

    const { id, method, params } = event.data;

    void (async () => {
      try {
        const response = (await browser.runtime.sendMessage({
          type: "eip1193-request",
          tabId: 0,
          id,
          method,
          params,
        } satisfies ExtEip1193RequestMessage)) as unknown;

        if (
          !response ||
          typeof response !== "object" ||
          !("type" in response) ||
          response.type !== "eip1193-response"
        ) {
          const errorMessage =
            response &&
            typeof response === "object" &&
            "error" in response &&
            typeof (response as { error: unknown }).error === "string"
              ? (response as { error: string }).error
              : "No response from wallet";
          postToPage({
            source: CONTENT_SOURCE,
            version: PROTOCOL_VERSION,
            type: "response",
            id,
            error: {
              code: -32603,
              message: errorMessage,
            },
          });
          return;
        }

        const ok = response as ExtEip1193ResponseMessage;
        postToPage({
          source: CONTENT_SOURCE,
          version: PROTOCOL_VERSION,
          type: "response",
          id: ok.id,
          result: ok.result,
          error: ok.error,
        });
      } catch (error) {
        postToPage({
          source: CONTENT_SOURCE,
          version: PROTOCOL_VERSION,
          type: "response",
          id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    })();
  });

  browser.runtime.onMessage.addListener((message: ExtRuntimeMessage) => {
    if (message.type === "eip1193-event") {
      const eventMsg = message as ExtEip1193EventMessage;
      postToPage({
        source: CONTENT_SOURCE,
        version: PROTOCOL_VERSION,
        type: "event",
        event: eventMsg.event,
        params: eventMsg.params,
      });
    }
    if (message.type === "eip1193-response") {
      postToPage({
        source: CONTENT_SOURCE,
        version: PROTOCOL_VERSION,
        type: "response",
        id: message.id,
        result: message.result,
        error: message.error,
      });
    }
  });
}

export default defineContentScript({
  matches: ["<all_urls>"],
  registration: "runtime",
  async main() {
    // Document marker is for humans/devtools; the isolated-world flag is what
    // prevents double-binding within one content-script context. When WXT
    // invalidates an old context and injects a new one, the flag is gone and
    // we must re-bind — even if the DOM marker remains.
    document.documentElement.setAttribute(MARKER, "1");
    installBridge();
    await sendConfig();
  },
});
