import { defineConfig } from "wxt";

/**
 * Production CSP: styles/scripts from the extension package only.
 *
 * Dev (`wxt` / `wxt -b firefox`): HTML entrypoints load CSS/JS from the Vite
 * server (http://localhost:3000). WXT auto-adds that origin to `script-src`,
 * but not `style-src` — without localhost in style-src, Firefox blocks
 * sidepanel/options CSS and the Inline wallet iframe covers the unstyled
 * Inject chrome.
 */
function extensionPagesCsp(command: "build" | "serve"): string {
  const isDev = command === "serve";
  return [
    isDev
      ? "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'"
      : "script-src 'self'",
    "object-src 'self'",
    // Branding iframe: prod + common local / tunnel hosts (test extension).
    "frame-src 'self' https: http://localhost:* http://127.0.0.1:*",
    "img-src 'self' data: https:",
    isDev
      ? "style-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:*"
      : "style-src 'self' 'unsafe-inline'",
  ].join("; ");
}

export default defineConfig({
  srcDir: ".",
  entrypointsDir: "entrypoints",
  outDir: "dist",
  modulesDir: "modules",
  manifestVersion: 3,
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  manifest: ({ browser, command }) => ({
    name: "1Shot Wallet",
    description:
      "Use the 1Shot embedded wallet as a MetaMask-style provider on any dApp (EIP-1193 + EIP-6963).",
    version: "0.1.0",
    permissions:
      browser === "firefox"
        ? ["storage", "scripting", "activeTab", "tabs"]
        : ["storage", "scripting", "sidePanel", "activeTab", "tabs"],
    optional_host_permissions: ["<all_urls>"],
    icons: {
      16: "icon/16.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
    action: {
      default_title: "1Shot Wallet",
      default_icon: {
        16: "icon/16.png",
        48: "icon/48.png",
        128: "icon/128.png",
      },
    },
    options_ui: {
      open_in_tab: true,
    },
    content_security_policy: {
      extension_pages: extensionPagesCsp(command),
    },
    browser_specific_settings: {
      gecko: {
        id: "wallet-extension@1shotapi.com",
        strict_min_version: "128.0",
      },
    },
  }),
  hooks: {
    "build:manifestGenerated": (wxt, manifest) => {
      if (manifest.options_ui) {
        manifest.options_ui.open_in_tab = true;
      }

      // Firefox does not use the Chromium `sandbox` CSP bucket; WXT still
      // injects it in serve mode and about:debugging warns on it.
      if (
        wxt.config.browser === "firefox" &&
        manifest.content_security_policy &&
        "sandbox" in manifest.content_security_policy
      ) {
        delete (manifest.content_security_policy as { sandbox?: string })
          .sandbox;
      }

      // Belt-and-suspenders: after WXT adds script-src localhost, ensure
      // style-src also allows the exact Vite origin (port-specific).
      if (wxt.config.command !== "serve") {
        return;
      }
      const origin = wxt.server?.origin;
      const pages = manifest.content_security_policy?.extension_pages;
      if (!origin || typeof pages !== "string") {
        return;
      }
      if (pages.includes("style-src") && !pages.includes(origin)) {
        manifest.content_security_policy!.extension_pages = pages.replace(
          /style-src [^;]+/,
          (match) => `${match} ${origin}`,
        );
      }
    },
  },
  vite: () => ({
    build: {
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  }),
});
